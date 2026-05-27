const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const axios = require('axios');

// ─── Path Helpers ────────────────────────────────────────────────────────────
// pkg 打包后 __dirname 是虚拟路径不可写，改用 EXE 所在目录
// 配置只从 launcher.js / EXE 旁边的 config.json 读取，不 merge 任何硬编码兜底值
const isPkgBundled = typeof process.pkg !== 'undefined';
const CONFIG_PATH = isPkgBundled
  ? path.join(path.dirname(process.execPath), 'config.json')
  : path.join(__dirname, 'config.json');

// ─── Colour Helpers ──────────────────────────────────────────────────────────
const C = { reset: '\x1b[0m', cyan: '\x1b[36m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', bold: '\x1b[1m' };
function clr(text, code) { return code + text + C.reset; }

// ─── Config ──────────────────────────────────────────────────────────────────
let config = null;
let availableModels = [];
let rl = null;

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {
    config = null;
  }
  // 未找到 config.json 时创建模板
  if (!config) {
    config = {
      baseUrl: '',
      apiKey: '',
      model: 'auto',
      workingDir: os.homedir()
    };
    saveConfig();
    console.log(clr('已在 "' + CONFIG_PATH + '" 创建配置文件模板，请填入 API 信息后重新启动', C.yellow));
  }
  // 补齐可选字段
  config.model = config.model || 'auto';
  config.workingDir = config.workingDir || os.homedir();
  return config ? CONFIG_PATH : null;
}

function saveConfig() {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error(clr('保存配置失败: ' + e.message, C.red));
  }
}

// ─── Folder Picker (GUI) ─────────────────────────────────────────────────────
function pickFolder(startPath) {
  const tmpFile = path.join(os.tmpdir(), 'cb_folder_picker.tmp.ps1');
  const escapedPath = (startPath || os.homedir()).replace(/'/g, "''");
  const psScript = `\
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$d=New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description='请选择 CodeBuddy 工作目录'
$d.SelectedPath='${escapedPath}'
$d.ShowNewFolderButton=$true
[System.Windows.Forms.Application]::EnableVisualStyles()
if($d.ShowDialog() -eq 'OK'){$d.SelectedPath}else{''}
`;
  // PowerShell 需要 UTF-8 BOM 才能正确解析中文字符
  fs.writeFileSync(tmpFile, '\uFEFF' + psScript, 'utf8');

  try {
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${tmpFile}"`,
      { encoding: 'utf8', timeout: 60000 }
    ).trim();
    try { fs.unlinkSync(tmpFile); } catch {}
    return result || null;
  } catch {
    try { fs.unlinkSync(tmpFile); } catch {}
    return null;
  }
}

// ─── API Helpers ─────────────────────────────────────────────────────────────
async function fetchModels() {
  try {
    console.log(clr('  正在获取模型列表...', C.cyan));
    const resp = await axios.get(`${config.baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${config.apiKey}` },
      timeout: 10000
    });
    if (resp.data && resp.data.data) {
      availableModels = resp.data.data.map(m => m.id).sort();
      console.log(clr(`  √ 已获取 ${availableModels.length} 个模型`, C.green));
      return true;
    }
  } catch (e) {
    console.log(clr('  × 获取模型列表失败: ' + (e.response ? e.response.status : e.message), C.red));
  }
  return false;
}

// ─── Interactive Menu ────────────────────────────────────────────────────────
async function setupConfig() {
  console.log('\n' + '═'.repeat(50));
  console.log(clr('        CodeBuddy 快速启动器 v2.0', C.bold + C.cyan));
  console.log('═'.repeat(50) + '\n');

  console.log('当前配置:');
  console.log(`  URL  : ${config.baseUrl}`);
  console.log(`  Token: ${config.apiKey ? config.apiKey.substring(0, 10) + '...' : '(未设置)'}`);
  console.log(`  模型 : ${config.model}\n`);
  console.log(`  配置文件: ${CONFIG_PATH}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q = (prompt) => new Promise(res => rl.question(prompt, res));

  while (true) {
    console.log(clr('[1] 使用默认配置直接启动', C.green));
    console.log('----------------------------------------');
    console.log('[2] 自定义 API 配置');
    console.log('[3] 切换模型');
    console.log('[4] 选择工作目录');
    console.log('[5] 查看可用模型');
    console.log('[6] 帮助');
    console.log('[0] 退出\n');

    const choice = await q('请选择: ');

    if (choice === '0') {
      rl.close();
      process.exit(0);
    } else if (choice === '1') {
      rl.close();
      return true;
    } else if (choice === '2') {
      console.log();
      const url = await q('API URL (回车保留当前): ');
      const token = await q('API Token (回车保留当前): ');
      if (url.trim()) config.baseUrl = url.trim();
      if (token.trim()) config.apiKey = token.trim();
      saveConfig();
      const ok = await fetchModels();
      if (!ok) console.log(clr('配置测试失败，但已保存', C.yellow));
    } else if (choice === '3') {
      if (availableModels.length === 0) {
        console.log(clr('\n模型列表为空，请先获取模型', C.yellow));
        const ok = await fetchModels();
        if (!ok) continue;
      }
      showModelList();
      const sel = await q('\n输入模型编号或名称 (回车保持' + config.model + '): ');
      if (sel.trim()) {
        const num = parseInt(sel);
        if (!isNaN(num) && num > 0 && num <= availableModels.length) {
          config.model = availableModels[num - 1];
        } else {
          const found = availableModels.find(m =>
            m.toLowerCase() === sel.toLowerCase() || m.toLowerCase().includes(sel.toLowerCase())
          );
          if (found) config.model = found;
          else console.log(clr('未找到匹配模型', C.red));
        }
        saveConfig();
        console.log(clr(`当前模型: ${config.model}`, C.green));
      }
    } else if (choice === '4') {
      const dir = pickFolder(config.workingDir || os.homedir());
      if (dir && fs.existsSync(dir)) {
        config.workingDir = dir;
        saveConfig();
        console.log(clr(`工作目录: ${dir}`, C.green));
      } else if (dir) {
        console.log(clr('目录不存在', C.red));
      }
    } else if (choice === '5') {
      if (availableModels.length === 0) await fetchModels();
      showModelList();
      await q('\n按回车继续...');
    } else if (choice === '6') {
      showHelp();
      await q('\n按回车继续...');
    }
  }
}

function showModelList() {
  console.log(clr('\n═══════ 可用模型 ═══════', C.cyan));
  availableModels.forEach((m, i) => {
    const marker = m === config.model ? clr('▶', C.green) : ' ';
    const name = m.length > 60 ? m.substring(0, 57) + '...' : m.padEnd(60);
    console.log(`  ${String(i + 1).padStart(2)}. ${marker} ${name}`);
  });
  console.log(clr('═════════════════════════\n', C.cyan));
}

function showHelp() {
  console.log(clr('\n═══════ 命令帮助 ═══════', C.cyan));
  console.log('  快速启动.bat   → GUI 选目录后直接启动');
  console.log('  启动CodeBuddy.bat → 交互模式（含命令行菜单）');
  console.log('  --config       → 进入配置菜单');
  console.log('  --interactive  → 进入交互循环模式');
  console.log('  --help         → 显示此帮助');
  console.log('');
  console.log('  配置菜单命令:');
  console.log('  [1] 默认配置直接启动');
  console.log('  [2] 自定义 API 配置');
  console.log('  [3] 切换模型');
  console.log('  [4] 选择工作目录（GUI 对话框）');
  console.log('  [5] 查看可用模型');
  console.log('[6] 帮助');
  console.log('[0] 退出');
  console.log(clr('═════════════════════════', C.cyan));
}

function showStatus() {
  console.log('\n' + clr('═══ 当前状态 ═══', C.cyan));
  console.log(`  API  : ${config.baseUrl}`);
  console.log(`  模型 : ${config.model}`)
  console.log(`  目录 : ${config.workingDir}`);
  console.log('═'.repeat(20));
}

// ─── Launch CodeBuddy ────────────────────────────────────────────────────────
function launchCodebuddy(args = []) {
  const fullArgs = ['--model', config.model, ...args];

  const env = {
    ...process.env,
    CODEBUDDY_BASE_URL: config.baseUrl,
    CODEBUDDY_API_KEY: config.apiKey
  };

  const cp = spawn('codebuddy', fullArgs, {
    env,
    stdio: 'inherit',
    shell: true,
    cwd: config.workingDir
  });

  return new Promise((resolve) => {
    cp.on('close', (code) => {
      resolve(code ?? 0);
    });

    cp.on('error', (err) => {
      console.error(clr(`\n启动失败: ${err.message}`, C.red));
      console.log(clr('请确保 codebuddy 已安装并在 PATH 中', C.yellow));
      resolve(1);
    });
  });
}

// ─── Interactive Loop ─────────────────────────────────────────────────────────
async function interactiveLoop() {
  const loop = async () => {
    const cli = readline.createInterface({ input: process.stdin, output: process.stdout });
    const q = (p) => new Promise((r) => cli.question(p, r));
    let keepGoing = true;

    while (keepGoing) {
      process.stdout.write('\x1b[2J\x1b[H\x1b[3J');
      showStatus();
      console.log();

      console.log('  p        → 启动 CodeBuddy 交互模式');
      console.log('  /model   → 切换模型');
      console.log('  /dir     → 切换工作目录（GUI 选择）');
      console.log('  /config  → 查看/修改 API 配置');
      console.log('  /help    → 帮助');
      console.log('  /exit    → 退出');
      console.log('  直接输入 → 作为 prompt 单次执行');
      console.log();

      const input = await q('> ');
      const cmd = input.trim();

      if (cmd === '' || cmd === 'help') {
        continue;
      } else if (cmd === '/exit' || cmd === '/quit' || cmd === '/q') {
        console.log(clr('再见!', C.cyan));
        cli.close();
        process.exit(0);
      } else if (cmd === '/model' || cmd === '/m') {
        if (availableModels.length === 0) {
          console.log(clr('\n模型列表为空，正在获取...', C.cyan));
          await fetchModels();
        }
        if (availableModels.length > 0) {
          showModelList();
          const sel = await q('输入模型编号或名称 (回车保持): ');
          if (sel.trim()) {
            const num = parseInt(sel);
            if (!isNaN(num) && num > 0 && num <= availableModels.length) {
              config.model = availableModels[num - 1];
            } else {
              const found = availableModels.find(m => m.toLowerCase() === sel.toLowerCase());
              if (found) config.model = found;
              else console.log(clr('未找到匹配模型', C.red));
            }
            saveConfig();
          }
        }
      } else if (cmd === '/dir' || cmd === '/d') {
        const dir = pickFolder(config.workingDir || os.homedir());
        if (dir && fs.existsSync(dir)) {
          config.workingDir = dir;
          saveConfig();
          console.log(clr(`工作目录已切换: ${dir}`, C.green));
          await q('按回车继续...');
        }
      } else if (cmd === '/config' || cmd === '/c') {
        console.log(clr(`\nAPI URL : ${config.baseUrl}`, C.cyan));
        console.log(clr(`Token   : ${config.apiKey ? config.apiKey.substring(0, 10) + '...' : '(未设置)'}`, C.cyan));
        console.log(clr(`模型    : ${config.model}`, C.cyan));
        console.log(clr(`配置文件: ${CONFIG_PATH}`, C.cyan));
        const chg = await q('\n修改 API 配置? (y/回车=不改): ');
        if (chg.toLowerCase() === 'y') {
          console.log();
          const url = await q('API URL (回车保留当前): ');
          const token = await q('API Token (回车保留当前): ');
          if (url.trim()) config.baseUrl = url.trim();
          if (token.trim()) config.apiKey = token.trim();
          saveConfig();
          console.log(clr('配置已保存', C.green));
          // 尝试拉取模型列表以验证
          const ok = await fetchModels();
          if (!ok) console.log(clr('API 连接测试失败，请检查配置', C.yellow));
          await q('按回车继续...');
        }
      } else if (cmd === '/help' || cmd === '/h') {
        showHelp();
        await q('\n按回车继续...');
      } else if (cmd === 'p') {
        cli.close();
        await launchCodebuddy();
        return true; // restart loop with fresh readline
      } else {
        cli.close();
        await launchCodebuddy(['-p', cmd]);
        return true; // restart loop with fresh readline
      }
    }
  };

  // After each launchCodebuddy call, we need a fresh readline
  while (await loop()) {}
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  loadConfig();

  const args = process.argv.slice(2);

  // --help
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  // --config mode
  if (args.includes('--config') || args.includes('-c')) {
    await setupConfig();
    // After config, pick folder
    console.log();
    const dir = pickFolder(config.workingDir || os.homedir());
    if (dir && fs.existsSync(dir)) {
      config.workingDir = dir;
      saveConfig();
    } else if (dir) {
      console.log(clr('目录不存在，使用默认目录', C.yellow));
    }
    process.exit(await launchCodebuddy());
  }

  // --interactive mode (启动CodeBuddy.bat)
  if (args.includes('--interactive') || args.includes('-i')) {
    // Ensure working dir is set
    if (!config.workingDir || !fs.existsSync(config.workingDir)) {
      console.log(clr('\n选择工作目录以启动 CodeBuddy...', C.yellow));
      const dir = pickFolder(os.homedir());
      if (dir && fs.existsSync(dir)) {
        config.workingDir = dir;
        saveConfig();
      }
    }
    await interactiveLoop();
    return;
  }

  // Default quick-launch mode (快速启动.bat)
  console.log('\n' + '═'.repeat(50));
  console.log(clr('      CodeBuddy 快速启动器 v2.0', C.bold + C.cyan));
  console.log('═'.repeat(50));
  console.log(clr('  选择工作目录以启动 CodeBuddy...', C.yellow));
  console.log('═'.repeat(50) + '\n');

  const dir = pickFolder(config.workingDir || os.homedir());

  if (!dir) {
    console.log(clr('\n未选择目录，已取消启动', C.yellow));
    process.exit(0);
  }

  if (!fs.existsSync(dir)) {
    console.log(clr(`\n目录不存在: ${dir}`, C.red));
    process.exit(1);
  }

  config.workingDir = dir;
  saveConfig();
  process.exit(await launchCodebuddy());
}

main().catch(err => {
  console.error(clr('错误: ' + err.message, C.red));
  process.exit(1);
});