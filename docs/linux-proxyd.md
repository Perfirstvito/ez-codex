# Linux Proxyd

`codex-tools-proxyd` 是从桌面端本地反代里拆出来的独立代理进程，目标是给后续“远程 Linux 服务器部署 + 桌面端管理”打基础。

当前支持：

- 独立启动 `/v1` 代理
- 复用现有 Codex 上游转发逻辑
- 复用 `accounts.json` 和固定 `api-proxy.key` 持久化
- 启动时可选自动把当前 `~/.codex/auth.json` 导入到账号池
- 桌面端「API 反代 → 远程服务器」里的服务器管理 UI
- SSH 一键部署（交叉编译 + 上传 + 安装 systemd 服务 + 启停与日志查看）

桌面端一键部署走的是 `src-tauri/src/remote_service.rs`，
会依次尝试 `cross` / `cargo zigbuild` / `cargo build --target`，
本文下面的手工编译流程主要用于自己在 Linux 上直接构建。

## 编译

```bash
cargo build --manifest-path src-tauri/proxyd/Cargo.toml
```

## 启动

```bash
./src-tauri/proxyd/target/debug/codex-tools-proxyd serve \
  --data-dir ~/.codex-tools-proxyd \
  --host 0.0.0.0 \
  --port 8787
```

默认值：

- `--data-dir ~/.codex-tools-proxyd`
- `--host 0.0.0.0`
- `--port 8787`
- 请求体大小上限默认 `512 MiB`

如果你不希望启动时自动把当前 `~/.codex/auth.json` 写入账号池，可以加：

```bash
--no-sync-current-auth
```

如果需要覆盖默认请求体大小上限，可以在启动前设置环境变量：

```bash
CODEX_TOOLS_PROXY_MAX_BODY_MIB=1024 ./src-tauri/proxyd/target/debug/codex-tools-proxyd serve \
  --data-dir ~/.codex-tools-proxyd \
  --host 0.0.0.0 \
  --port 8787
```

## 数据目录

daemon 会在 `data-dir` 下维护：

- `accounts.json`
- `api-proxy.key`

其中：

- `accounts.json` 用法和桌面端一致
- `api-proxy.key` 会固定保存本地代理 API Key，除非手动刷新

## 启动输出

启动成功后会打印：

- `data_dir=...`
- `listen=http://HOST:PORT/v1`
- `api_key=sk-...`

## 停止

- 前台运行时可直接 `Ctrl+C`
- 在 Linux 上也支持 `SIGTERM`

## 说明

这个 daemon 和桌面端本地反代共用同一套核心逻辑
（`src-tauri/src/proxy_service.rs`），区别只在于没有 Tauri 窗口和托盘。
反代本身的协议转换、账号挑选与切号规则见 [api-proxy.md](api-proxy.md)。

注意启动时的账号同步语义和桌面端不同：

- 桌面端启动时只对齐已入库账号，不会自动把陌生登录态写进账号池
- `proxyd` 默认允许导入（无人值守场景需要），可用 `--no-sync-current-auth` 关掉
