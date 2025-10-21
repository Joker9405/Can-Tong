Can-Tong · OOV 扩展包（2025-10-21）

零代码覆盖包：
1) 新增 OOV 自动学读音/发音（优先你的 TTS；无则用浏览器 zh-HK）。
2) 不含“三挡/变体”。

【如何使用】
A. 把仓库里的 index.html、app.js 用本包同名文件覆盖；
B. 把 oov.js 放在仓库根目录；
C. 把 data/unihan_kCantonese.min.json 放在仓库 data/ 目录（若没有 data 目录，请创建）。

【可选：配置你的 TTS】
访问页面时，URL 追加参数：?tts=你的TTS地址
例如：index.html?tts=https://can-tong-huc3.vercel.app/api/tts
接口协议：GET/POST text, voice=zh-HK, format=mp3 → 返回 audio/mpeg。

【提示】
如想保留你原有样式/脚本，只替换 oov.js 与 data/，并确保在页面里引入：
<script src="./oov.js"></script>
并在你的初始化脚本里调用：OOV.init({ dictURL: './data/unihan_kCantonese.min.json' })
在渲染结果后调用：OOV.ensureLearned(文本)，在发音时调用：OOV.speak(文本)。