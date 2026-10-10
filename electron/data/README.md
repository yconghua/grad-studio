# 工具箱本地数据目录

此目录用于放置「工具箱」需要本地维护的数据集。

## ShowJCR 期刊数据（jcr-data.json）

期刊查询工具的 ShowJCR 源读取本目录下的 `jcr-data.json`。
数据来源：ShowJCR 开源数据集（GitHub 发布），覆盖 22,299 种期刊 + 15 种计算机会议。

- 文件不存在时，期刊查询的 ShowJCR 源会标记为「本地数据集未导入」，不影响其他数据源；
- 放置后需重启应用（服务启动时加载一次）。

### 数据结构（数组，每项字段说明）

```json
[
  {
    "name": "期刊全名",
    "issn": "印刷版 ISSN",
    "eissn": "电子版 ISSN",
    "publisher": "出版社",
    "if2022": 影响因子（2022），
    "if2023": 影响因子（2023），
    "if2024": 影响因子（2024），
    "cas_zone_base": 中科院分区（基础版，1~4 或空），
    "cas_zone_upgrade": 中科院分区（升级版，1~4 或空），
    "cas_warning": 是否中科院预警（true/false），
    "top": 是否 Top 期刊（true/false），
    "is_oa": 是否开放获取（可选）
  }
]
```

中科院分区等字段若维护在独立文件中，可参照本目录另行放置并在
`electron/services/providers/journalSources.js` 中接入（当前版本仅接入 ShowJCR 数据集）。
