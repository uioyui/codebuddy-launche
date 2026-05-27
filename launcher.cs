using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace CodeBuddyLauncher
{
    public class Config
    {
        public string BaseUrl = "https://api.iamhc.cn/v1";
        public string ApiKey = "sk-gKGiW5WzUqkBO1yNVjPpNtcbJdjHPxQUtudTWC5xLXJUZb2G";
        public string Model = "auto";
        public string WorkingDir = "";

        public static Config Load(string path)
        {
            var cfg = new Config();
            if (File.Exists(path))
            {
                try
                {
                    string json = File.ReadAllText(path);
                    cfg.BaseUrl = ExtractValue(json, "baseUrl") ?? cfg.BaseUrl;
                    cfg.ApiKey = ExtractValue(json, "apiKey") ?? cfg.ApiKey;
                    cfg.Model = ExtractValue(json, "model") ?? cfg.Model;
                    cfg.WorkingDir = ExtractValue(json, "workingDir") ?? cfg.WorkingDir;
                }
                catch { }
            }
            if (string.IsNullOrEmpty(cfg.WorkingDir))
                cfg.WorkingDir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            return cfg;
        }

        public void Save(string path)
        {
            string json = "{\n" +
                "  \"baseUrl\": \"" + EscapeJson(BaseUrl) + "\",\n" +
                "  \"apiKey\": \"" + EscapeJson(ApiKey) + "\",\n" +
                "  \"model\": \"" + EscapeJson(Model) + "\",\n" +
                "  \"workingDir\": \"" + EscapeJson(WorkingDir) + "\"\n" +
                "}";
            File.WriteAllText(path, json);
        }

        private static string ExtractValue(string json, string key)
        {
            int keyIdx = json.IndexOf("\"" + key + "\"");
            if (keyIdx < 0) return null;
            int colonIdx = json.IndexOf(':', keyIdx);
            if (colonIdx < 0) return null;
            int start = json.IndexOf('"', colonIdx);
            if (start < 0) return null;
            int end = json.IndexOf('"', start + 1);
            if (end < 0) return null;
            return json.Substring(start + 1, end - start - 1);
        }

        private static string EscapeJson(string s)
        {
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
        }
    }

    public class MainForm : Form
    {
        private Config _config;
        private string _configPath;
        private bool _startWithConfig;

        private TextBox _urlBox;
        private TextBox _tokenBox;
        private TextBox _modelBox;
        private TextBox _dirBox;
        private Button _launchBtn;
        private Label _statusLabel;
        private CheckBox _showConfigCheck;

        // Config panel controls
        private Label _urlLabel;
        private Label _tokenLabel;
        private Label _modelLabel;
        private CheckBox _showTokenCheck;

        public MainForm(string configPath, bool showConfig = false)
        {
            _configPath = configPath;
            _config = Config.Load(configPath);
            _startWithConfig = showConfig;
            InitializeComponent();
            LoadConfigToUI();
        }

        private void InitializeComponent()
        {
            this.Text = "CodeBuddy 快速启动器 v2.0";
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.Size = new Size(580, 210);

            int y = 15;

            // Title
            var title = new Label
            {
                Text = "CodeBuddy 快速启动器",
                Font = new Font("Microsoft YaHei", 14, FontStyle.Bold),
                ForeColor = Color.FromArgb(0, 120, 212),
                Location = new Point(15, y),
                Size = new Size(530, 30),
                TextAlign = ContentAlignment.MiddleCenter
            };
            this.Controls.Add(title);
            y += 40;

            // Separator
            var sep = new Label
            {
                BorderStyle = BorderStyle.Fixed3D,
                Location = new Point(15, y),
                Size = new Size(530, 2)
            };
            this.Controls.Add(sep);
            y += 15;

            // Show config checkbox
            _showConfigCheck = new CheckBox
            {
                Text = "显示高级配置 (API/模型)",
                Location = new Point(15, y),
                Size = new Size(200, 22),
                Checked = _startWithConfig
            };
            _showConfigCheck.CheckedChanged += ShowConfig_Changed;
            this.Controls.Add(_showConfigCheck);
            y += 30;

            // Working Directory
            var dirLabel = new Label { Text = "工作目录:", Location = new Point(15, y), Size = new Size(70, 23) };
            this.Controls.Add(dirLabel);
            _dirBox = new TextBox { Location = new Point(85, y), Size = new Size(380, 23) };
            this.Controls.Add(_dirBox);
            var browseBtn = new Button { Text = "浏览...", Location = new Point(470, y - 1), Size = new Size(75, 25) };
            browseBtn.Click += BrowseBtn_Click;
            this.Controls.Add(browseBtn);
            y += 35;

            // === Config Panel (hidden by default) ===
            // API URL
            _urlLabel = new Label { Text = "API URL:", Location = new Point(15, y), Size = new Size(70, 23) };
            this.Controls.Add(_urlLabel);
            _urlBox = new TextBox { Location = new Point(85, y), Size = new Size(460, 23) };
            this.Controls.Add(_urlBox);
            y += 35;

            // API Token
            _tokenLabel = new Label { Text = "Token:", Location = new Point(15, y), Size = new Size(70, 23) };
            this.Controls.Add(_tokenLabel);
            _tokenBox = new TextBox
            {
                Location = new Point(85, y),
                Size = new Size(380, 23),
                PasswordChar = '\u25CF'
            };
            this.Controls.Add(_tokenBox);
            _showTokenCheck = new CheckBox { Text = "显示", Location = new Point(470, y), Size = new Size(75, 22) };
            _showTokenCheck.CheckedChanged += (s, e) =>
            {
                _tokenBox.PasswordChar = _showTokenCheck.Checked ? '\0' : '\u25CF';
            };
            this.Controls.Add(_showTokenCheck);
            y += 35;

            // Model
            _modelLabel = new Label { Text = "模型:", Location = new Point(15, y), Size = new Size(70, 23) };
            this.Controls.Add(_modelLabel);
            _modelBox = new TextBox { Location = new Point(85, y), Size = new Size(460, 23) };
            this.Controls.Add(_modelBox);
            y += 35;

            // Set initial visibility
            SetConfigVisibility(_startWithConfig);
            if (_startWithConfig)
                this.Size = new Size(580, 350);

            // Buttons
            y += 5;
            _launchBtn = new Button
            {
                Text = "  启动 CodeBuddy  ",
                Location = new Point(15, y),
                Size = new Size(160, 40),
                Font = new Font("Microsoft YaHei", 10, FontStyle.Bold),
                BackColor = Color.FromArgb(0, 120, 212),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat
            };
            _launchBtn.Click += LaunchBtn_Click;
            this.Controls.Add(_launchBtn);

            var saveBtn = new Button
            {
                Text = "保存配置",
                Location = new Point(190, y),
                Size = new Size(90, 40),
                Font = new Font("Microsoft YaHei", 9)
            };
            saveBtn.Click += SaveBtn_Click;
            this.Controls.Add(saveBtn);

            var exitBtn = new Button
            {
                Text = "退出",
                Location = new Point(465, y),
                Size = new Size(80, 40),
                Font = new Font("Microsoft YaHei", 9)
            };
            exitBtn.Click += (s, e) => Application.Exit();
            this.Controls.Add(exitBtn);
            y += 50;

            // Status bar
            _statusLabel = new Label
            {
                Text = "就绪 - 选择工作目录后点击启动",
                Location = new Point(15, y + 2),
                Size = new Size(530, 23),
                ForeColor = Color.Gray
            };
            this.Controls.Add(_statusLabel);

            this.AcceptButton = _launchBtn;
        }

        private void LoadConfigToUI()
        {
            _urlBox.Text = _config.BaseUrl;
            _tokenBox.Text = _config.ApiKey;
            _modelBox.Text = _config.Model;
            _dirBox.Text = _config.WorkingDir;
        }

        private void SaveConfigFromUI()
        {
            _config.BaseUrl = _urlBox.Text.Trim();
            _config.ApiKey = _tokenBox.Text.Trim();
            _config.Model = _modelBox.Text.Trim();
            _config.WorkingDir = _dirBox.Text.Trim();
            _config.Save(_configPath);
        }

        private void SetConfigVisibility(bool visible)
        {
            _urlBox.Visible = visible;
            _urlLabel.Visible = visible;
            _tokenBox.Visible = visible;
            _tokenLabel.Visible = visible;
            _modelBox.Visible = visible;
            _modelLabel.Visible = visible;
            _showTokenCheck.Visible = visible;

            this.Size = visible ? new Size(580, 350) : new Size(580, 210);
        }

        private void ShowConfig_Changed(object sender, EventArgs e)
        {
            SetConfigVisibility(_showConfigCheck.Checked);
        }

        private void BrowseBtn_Click(object sender, EventArgs e)
        {
            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "选择 CodeBuddy 工作目录";
                dialog.SelectedPath = string.IsNullOrEmpty(_dirBox.Text)
                    ? Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)
                    : _dirBox.Text;
                dialog.ShowNewFolderButton = true;
                if (dialog.ShowDialog() == DialogResult.OK)
                {
                    _dirBox.Text = dialog.SelectedPath;
                }
            }
        }

        private void SaveBtn_Click(object sender, EventArgs e)
        {
            SaveConfigFromUI();
            _statusLabel.Text = "配置已保存";
            _statusLabel.ForeColor = Color.Green;

            var timer = new Timer { Interval = 2000 };
            timer.Tick += (s, args) =>
            {
                _statusLabel.Text = "配置已保存 - 选择工作目录后点击启动";
                _statusLabel.ForeColor = Color.Gray;
                timer.Stop();
                timer.Dispose();
            };
            timer.Start();
        }

        private void LaunchBtn_Click(object sender, EventArgs e)
        {
            string dir = _dirBox.Text.Trim();
            if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir))
            {
                var result = MessageBox.Show(
                    "工作目录无效，是否选择目录？",
                    "提示",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning);

                if (result == DialogResult.Yes)
                {
                    BrowseBtn_Click(null, null);
                    dir = _dirBox.Text.Trim();
                    if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir))
                        return;
                }
                else
                {
                    return;
                }
            }

            SaveConfigFromUI();
            _statusLabel.Text = "正在启动 CodeBuddy...";
            _statusLabel.ForeColor = Color.Blue;

            LaunchCodebuddy(_config);
        }

        private void LaunchCodebuddy(Config cfg)
        {
            try
            {
                // Normalize URL: strip trailing slash
                string baseUrl = cfg.BaseUrl.TrimEnd('/');

                // Build temp batch file for reliable env var passing
                string batPath = Path.Combine(Path.GetTempPath(), "codebuddy_launch.bat");
                string batContent =
                    "@echo off\r\n" +
                    "chcp 65001 >nul\r\n" +
                    "set \"CODEBUDDY_BASE_URL=" + baseUrl + "\"\r\n" +
                    "set \"CODEBUDDY_API_KEY=" + cfg.ApiKey + "\"\r\n" +
                    "codebuddy --model " + cfg.Model + "\r\n";

                File.WriteAllText(batPath, batContent);

                var psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/k \"" + batPath + "\"",
                    WorkingDirectory = cfg.WorkingDir,
                    UseShellExecute = true
                };

                Process.Start(psi);
                Application.Exit();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "启动 CodeBuddy 失败:\n" + ex.Message +
                    "\n\n请确保 codebuddy 已安装并在 PATH 中。",
                    "错误", MessageBoxButtons.OK, MessageBoxIcon.Error);
                _statusLabel.Text = "就绪 - 启动失败，请检查配置";
                _statusLabel.ForeColor = Color.Red;
            }
        }
    }

    public class Program
    {
        [STAThread]
        public static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string configPath = Path.Combine(exeDir, "config.json");

            bool showConfig = args.Length > 0 && (args[0] == "--config" || args[0] == "-c");

            var form = new MainForm(configPath, showConfig);
            Application.Run(form);
        }
    }
}