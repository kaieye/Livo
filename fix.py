import re
file_path = r'e:\Livo\apps\harmony\entry\src\main\ets\common\components\SettingsSecondaryPanels.ets'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('\\\'100%\\\'', \
100%
\)
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
