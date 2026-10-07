-- 科研成果附件：LONGBLOB 直接入库（与周报附件 report_attachment 同一模式）
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 设计约定（与周报附件一致）：
--   - 二进制 file_data 直接存库，不落磁盘；列表/元数据查询一律不 SELECT file_data（大字段隔离）；
--   - 删除 = 物理 DELETE（释放空间），成果删除 / 学生删除时事务内级联清理；
--   - 成果附件按成果归属（achievement_id）级联删除，不按上传者 user_id——
--     因为导师 / 超管可代填并上传附件，上传者未必是学生本人；
--   - change_ts：行变更时间戳（全局刷新指纹检测用）。

-- ===== 科研成果附件表 =====
CREATE TABLE IF NOT EXISTS `achievement_attachment` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '附件ID',
  `achievement_id` BIGINT       NOT NULL COMMENT '所属成果ID',
  `user_id`        BIGINT       NOT NULL COMMENT '上传者用户ID（学生本人或导师/超管代填）',
  `file_name`      VARCHAR(255) NOT NULL COMMENT '原始文件名',
  `file_size`      BIGINT       NOT NULL COMMENT '字节数',
  `mime_type`      VARCHAR(100) NOT NULL COMMENT 'MIME类型',
  `file_ext`       VARCHAR(20)  NOT NULL COMMENT '扩展名（小写，不带点）',
  `file_data`      LONGBLOB     NOT NULL COMMENT '文件二进制内容',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  `change_ts`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  KEY `idx_achievement` (`achievement_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研成果附件';
