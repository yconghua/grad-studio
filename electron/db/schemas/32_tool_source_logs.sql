-- 工具箱 · 数据源调用日志（32）
-- 按用户记录每次查询各数据源的调用状态；status：ok/fail/timeout/skipped(未配置Key)；
-- query_snapshot 为脱敏后的查询参数摘要；可手动清理，默认保留最近30天（服务层清理）。
CREATE TABLE IF NOT EXISTS `tool_source_logs` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `user_id`       BIGINT       NOT NULL COMMENT '用户ID',
  `tool`          VARCHAR(30)  NOT NULL COMMENT '工具：doi/journal/search/translate/company',
  `query_snapshot` VARCHAR(200) DEFAULT NULL COMMENT '脱敏查询参数摘要',
  `source_name`   VARCHAR(50)  NOT NULL COMMENT '数据源名称',
  `status`        VARCHAR(10)  NOT NULL COMMENT '状态：ok/fail/timeout/skipped',
  `cost_ms`       INT          NOT NULL DEFAULT 0 COMMENT '响应耗时（毫秒）',
  `result_count`  INT          NOT NULL DEFAULT 0 COMMENT '返回结果数量',
  `error_msg`     VARCHAR(500) DEFAULT NULL COMMENT '错误信息（如有）',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_time` (`user_id`, `created_at`),
  KEY `idx_tool` (`tool`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工具箱数据源调用日志';
