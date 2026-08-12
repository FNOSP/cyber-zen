param(
  [switch]$Install,
  [switch]$Push
)

$ErrorActionPreference = "Stop"
$ROOT = Split-Path -Parent $PSScriptRoot
$APP_DIR = Join-Path $ROOT "fnos_app"
$FPK_NAME = "cyber-woodenfish.fpk"

Write-Host "=== 打包 敲木鱼 fnOS 应用 ===" -ForegroundColor Cyan

# 1. 同步源码到 app 目录
Write-Host "[1/4] 同步源码到 fnos_app/app ..." -ForegroundColor Yellow
Copy-Item (Join-Path $ROOT "server.js") (Join-Path $APP_DIR "app\server.js") -Force
if (Test-Path (Join-Path $APP_DIR "app\public")) {
  Remove-Item (Join-Path $APP_DIR "app\public") -Recurse -Force
}
Copy-Item (Join-Path $ROOT "public") (Join-Path $APP_DIR "app\public") -Recurse -Force

# 2. 修复 cmd 生命周期脚本
Write-Host "[2/4] 补齐生命周期脚本 ..." -ForegroundColor Yellow
$scripts = @("install_init", "install_callback", "upgrade_init", "upgrade_callback",
             "uninstall_init", "uninstall_callback", "config_init", "config_callback")
$CMD_DIR = Join-Path $APP_DIR "cmd"
foreach ($s in $scripts) {
  $p = Join-Path $CMD_DIR $s
  if (-not (Test-Path $p)) {
    Set-Content -Path $p -Value "#!/bin/bash`nexit 0" -Encoding Ascii
  }
}
Get-ChildItem $CMD_DIR | ForEach-Object { $_.Attributes = "Normal" }

# 3. 推送到 git（可选）
if ($Push) {
  Write-Host "[3/4] 推送 git ..." -ForegroundColor Yellow
  Set-Location $ROOT
  git add -A
  git commit --allow-empty -m "chore: build prep $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
  git push
  Write-Host "  git 推送完成" -ForegroundColor Green
} else {
  Write-Host "[3/4] 跳过 git 推送（使用 -Push 参数启用）" -ForegroundColor DarkGray
}

# 4. 远程打包安装（可选）
if ($Install) {
  Write-Host "[4/4] 远程部署到 fnOS ..." -ForegroundColor Yellow
  # 传输源码
  opsctl cp -r $APP_DIR "hyper-v-fnos:/vol1/1000/datas/fnos_app" 2>&1 | Out-Null
  # 远程打包
  $build = opsctl exec hyper-v-fnos --type ssh -- "cd /vol1/1000/datas/fnos_app && fnpack build 2>&1" 2>&1
  if ($build -match "successfully") {
    Write-Host "  打包成功" -ForegroundColor Green
    # 卸载旧版
    opsctl exec hyper-v-fnos --type ssh -- "echo 'adminadmin1' | sudo -S appcenter-cli stop cyber-woodenfish 2>&1 | Out-Null
    opsctl exec hyper-v-fnos --type ssh -- "echo 'adminadmin1' | sudo -S appcenter-cli uninstall cyber-woodenfish 2>&1 | Out-Null
    # 安装新版
    $install = opsctl exec hyper-v-fnos --type ssh -- "echo 'adminadmin1' | sudo -S appcenter-cli install-fpk --volume 1 /vol1/1000/datas/fnos_app/cyber-woodenfish.fpk 2>&1" 2>&1
    if ($install -match "complete|success") {
      Write-Host "  安装成功" -ForegroundColor Green
      opsctl exec hyper-v-fnos --type ssh -- "echo 'adminadmin1' | sudo -S appcenter-cli start cyber-woodenfish 2>&1 | Out-Null
      Write-Host "  应用已启动" -ForegroundColor Green
    } else {
      Write-Host "  安装失败: $install" -ForegroundColor Red
    }
  } else {
    Write-Host "  打包失败: $build" -ForegroundColor Red
  }
} else {
  Write-Host "[4/4] 跳过远程部署（使用 -Install 参数启用）" -ForegroundColor DarkGray
}

Write-Host "=== 完成 ===" -ForegroundColor Cyan
Write-Host "使用方式:"
Write-Host "  .\build.ps1              # 仅本地同步"
Write-Host "  .\build.ps1 -Push        # 同步 + git 推送"
Write-Host "  .\build.ps1 -Install     # 同步 + 远程部署到 fnOS"
Write-Host "  .\build.ps1 -Push -Install  # 全部"