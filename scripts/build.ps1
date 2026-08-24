$ErrorActionPreference = "Stop"

# 远程服务器配置
$SshHost = "192.168.101.249"
$SshPort = 22
$SshUser = "admin"
$SshPassword = "adminadmin1"
$RemoteParentDir = "/vol1/1000/datas"
$RemoteAppDirectory = "fnos_app"
$AppName = "cyber-zen"
$CleanRemoteBuildDir = $true

$Root = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $Root "fnos_app"
$SshTarget = "$SshUser@$SshHost"
$RemoteAppDir = "$RemoteParentDir/$RemoteAppDirectory"
$SshOptions = @("-p", $SshPort, "-o", "StrictHostKeyChecking=accept-new")

if ([string]::IsNullOrWhiteSpace($SshPassword) -or $SshPassword -eq "请在此填写 SSH 密码") {
  throw "请先在脚本顶部填写 `$SshPassword。"
}

Write-Host "=== 打包 $AppName ===" -ForegroundColor Cyan

# 1. 准备待打包的应用目录
Write-Host "[1/3] 同步本地源码到 fnos_app/app ..." -ForegroundColor Yellow
Copy-Item (Join-Path $Root "server.js") (Join-Path $AppDir "app/server.js") -Force
if (Test-Path (Join-Path $AppDir "app/public")) {
  Remove-Item (Join-Path $AppDir "app/public") -Recurse -Force
}
Copy-Item (Join-Path $Root "public") (Join-Path $AppDir "app/public") -Recurse -Force

# OpenSSH 本身不接受命令行密码；通过临时 SSH_ASKPASS 脚本提供密码。
$AskPassFile = Join-Path $env:TEMP "fnos-ssh-askpass-$PID.cmd"
$OldAskPass = $env:SSH_ASKPASS
$OldAskPassRequire = $env:SSH_ASKPASS_REQUIRE
$OldDisplay = $env:DISPLAY
$OldPassword = $env:FNOS_SSH_PASSWORD

try {
  Set-Content -LiteralPath $AskPassFile -Value '@powershell.exe -NoProfile -Command "[Console]::Out.Write($env:FNOS_SSH_PASSWORD)"' -Encoding Ascii -NoNewline
  $env:FNOS_SSH_PASSWORD = $SshPassword
  $env:SSH_ASKPASS = $AskPassFile
  $env:SSH_ASKPASS_REQUIRE = "force"
  $env:DISPLAY = "fnos"

  # 2. 清理远程打包暂存目录并上传应用源码（不影响已安装应用的数据）。
  Write-Host "[2/3] 清理并上传源码到 ${SshTarget}:$RemoteAppDir ..." -ForegroundColor Yellow
  if ($CleanRemoteBuildDir) {
    $PrepareCommand = "test '$RemoteAppDir' = '$RemoteParentDir/$RemoteAppDirectory' && rm -rf -- '$RemoteAppDir' && mkdir -p '$RemoteAppDir'"
  } else {
    $PrepareCommand = "mkdir -p '$RemoteAppDir'"
  }
  & ssh.exe @SshOptions $SshTarget $PrepareCommand
  if ($LASTEXITCODE -ne 0) { throw "无法准备远程打包目录。" }

  $SourceItems = Get-ChildItem -LiteralPath $AppDir -Force | Select-Object -ExpandProperty FullName
  & scp.exe -r -P $SshPort -o "StrictHostKeyChecking=accept-new" @SourceItems "${SshTarget}:${RemoteAppDir}/"
  if ($LASTEXITCODE -ne 0) { throw "源码上传失败。" }

  # Windows SCP 上传的权限可能让 fnpack 无法读取 manifest；统一为常规目录/文件权限。
  $PermissionCommand = "find '$RemoteAppDir' -type d -exec chmod 755 {} + && find '$RemoteAppDir' -type f -exec chmod 644 {} + && find '$RemoteAppDir/cmd' -type f -exec chmod 755 {} +"
  & ssh.exe @SshOptions $SshTarget $PermissionCommand
  if ($LASTEXITCODE -ne 0) { throw "无法修复远程文件权限。" }

  # 3. 在远端打包并输出实际生成的 FPK 路径。
  Write-Host "[3/3] 在远端执行打包 ..." -ForegroundColor Yellow
  $BuildCommand = "export HOME=/tmp/fnpack-$SshUser; mkdir -p `"`$HOME`"; cd '$RemoteAppDir' || exit 1; fnpack build 2>&1; build_status=`$?; if [ `$build_status -ne 0 ]; then exit `$build_status; fi; package=`$(find '$RemoteAppDir' -maxdepth 1 -type f -name '*.fpk' -printf '%f\n' | head -n 1); if [ -z `"`$package`" ]; then echo '未找到 fnpack 生成的 .fpk 文件。' >&2; exit 1; fi; printf '%s/%s\n' '$RemoteAppDir' `"`$package`""
  $RemoteOutput = & ssh.exe @SshOptions $SshTarget $BuildCommand 2>&1
  $RemoteOutput | ForEach-Object { Write-Host $_ }
  if ($LASTEXITCODE -ne 0) { throw "远程打包失败。请根据上方 fnpack 输出排查。" }

  $RemotePackage = $RemoteOutput | Where-Object { $_ -match '\.fpk$' } | Select-Object -Last 1
  $PackageDir = Split-Path $RemotePackage -Parent
  Write-Host "打包完成，产物目录：$PackageDir" -ForegroundColor Green
  Write-Host "FPK 文件：$RemotePackage" -ForegroundColor Green
}
finally {
  Remove-Item -LiteralPath $AskPassFile -Force -ErrorAction SilentlyContinue
  $env:SSH_ASKPASS = $OldAskPass
  $env:SSH_ASKPASS_REQUIRE = $OldAskPassRequire
  $env:DISPLAY = $OldDisplay
  $env:FNOS_SSH_PASSWORD = $OldPassword
}
