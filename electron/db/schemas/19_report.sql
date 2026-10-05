-- 周报模块：学生周报 + 附件 + 模板 + 免交周 + 提醒去重
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 设计约定（与方案一致）：
--   - 一人一周一份：report 表 (user_id, week_key) 唯一索引硬保证；
--   - 无软删：学生无权删除周报，超管删除=物理删除（含附件），因此唯一索引不受软删影响；
--   - 状态机：draft / submitted / returned / reviewed；
--   - 附件 file_data 用 LONGBLOB 直接入库，列表查询不返回该列（大字段隔离）。

-- ===== 周报主表 =====
CREATE TABLE IF NOT EXISTS `report` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '周报ID',
  `user_id`        BIGINT       NOT NULL COMMENT '学生用户ID（服务端注入）',
  `group_id`       BIGINT       NOT NULL COMMENT '提交时所在课题组ID（冗余，转组后历史归属不变）',
  `week_key`       VARCHAR(8)   NOT NULL COMMENT 'ISO周：2026-40（服务端计算，客户端不可传）',
  `title`          VARCHAR(120) NOT NULL DEFAULT '' COMMENT '主题，1-120字',
  `content`        LONGTEXT     NOT NULL COMMENT 'Markdown 正文（可空，最长100000字）',
  `status`         VARCHAR(16)  NOT NULL DEFAULT 'draft' COMMENT '状态：draft/submitted/returned/reviewed',
  `is_late`        TINYINT      NOT NULL DEFAULT 0 COMMENT '是否补交：提交时间晚于该周周一00:00为1',
  `review_action`  VARCHAR(10)  DEFAULT NULL COMMENT '批阅动作：approve通过 / return打回',
  `review_comment` TEXT         DEFAULT NULL COMMENT '导师评语（通过必填）/ 打回理由（打回必填）',
  `review_score`   TINYINT      DEFAULT NULL COMMENT '评分1-5（通过时可填，可选）',
  `reviewed_by`    BIGINT       DEFAULT NULL COMMENT '批阅导师用户ID',
  `reviewed_at`    DATETIME     DEFAULT NULL COMMENT '批阅时间',
  `revoke_reason`  VARCHAR(255) DEFAULT NULL COMMENT '导师撤回批阅理由（24h内可撤回）',
  `revoked_at`     DATETIME     DEFAULT NULL COMMENT '撤回批阅时间',
  `submitted_at`   DATETIME     DEFAULT NULL COMMENT '提交时间（补交判定依据）',
  `template_id`    BIGINT       DEFAULT NULL COMMENT '新建时使用的模板ID',
  `version`        INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本号（写操作必须带版本条件）',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_week` (`user_id`, `week_key`),
  KEY `idx_user` (`user_id`),
  KEY `idx_group_status_week` (`group_id`, `status`, `week_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生周报';

-- ===== 周报附件（LONGBLOB 直接入库） =====
CREATE TABLE IF NOT EXISTS `report_attachment` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '附件ID',
  `report_id`  BIGINT       NOT NULL COMMENT '所属周报ID',
  `user_id`    BIGINT       NOT NULL COMMENT '上传者（学生）用户ID',
  `file_name`  VARCHAR(255) NOT NULL COMMENT '原始文件名',
  `file_size`  BIGINT       NOT NULL COMMENT '字节数',
  `mime_type`  VARCHAR(100) NOT NULL COMMENT 'MIME类型',
  `file_ext`   VARCHAR(20)  NOT NULL COMMENT '扩展名（小写，不带点）',
  `file_data`  LONGBLOB     NOT NULL COMMENT '文件二进制内容',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  `change_ts`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  KEY `idx_report` (`report_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周报附件';

-- ===== 周报模板（NULL=系统内置，非空=组模板） =====
CREATE TABLE IF NOT EXISTS `report_template` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '模板ID',
  `group_id`   BIGINT       DEFAULT NULL COMMENT '所属课题组（NULL=系统内置模板）',
  `name`       VARCHAR(50)  NOT NULL COMMENT '模板名称',
  `content`    MEDIUMTEXT    NOT NULL COMMENT '模板正文（Markdown 骨架，上限约16MB）',
  `is_default` TINYINT      NOT NULL DEFAULT 0 COMMENT '是否为默认模板（同范围仅一条为1）',
  `created_by` BIGINT       DEFAULT NULL COMMENT '创建人（组管）用户ID',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  KEY `idx_group` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周报模板';

-- 系统内置默认模板（四段式）：仅当不存在系统模板时写入
INSERT INTO `report_template` (`group_id`, `name`, `content`, `is_default`, `created_by`)
SELECT NULL, '通用周报模板',
'## 本周工作

（本周完成的主要工作）

## 遇到的问题

（遇到的问题与卡点）

## 下周计划

（下周计划开展的工作）

## 需要导师帮助

（需要导师指导或协助的事项）', 1, NULL
WHERE NOT EXISTS (SELECT 1 FROM `report_template` WHERE `group_id` IS NULL);

-- ===== 免交周（组管设置：该周不计入应提交） =====
CREATE TABLE IF NOT EXISTS `report_holiday` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `group_id`   BIGINT       NOT NULL COMMENT '课题组ID',
  `week_key`   VARCHAR(8)   NOT NULL COMMENT '免交周：2026-40',
  `reason`     VARCHAR(100) NOT NULL DEFAULT '' COMMENT '免交原因（如寒假）',
  `created_by` BIGINT       DEFAULT NULL COMMENT '设置人（组管）用户ID',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '设置时间',
  `change_ts`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_week` (`group_id`, `week_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周报免交周';

-- ===== 提醒去重日志（定时扫描用，每日/每类只提醒一次） =====
CREATE TABLE IF NOT EXISTS `report_remind_log` (
  `id`          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `week_key`    VARCHAR(8)  NOT NULL COMMENT '所属周',
  `user_id`     BIGINT      NOT NULL COMMENT '被提醒人用户ID',
  `remind_type` VARCHAR(20) NOT NULL COMMENT '类型：missed未交/review_48h批阅超时/review_72h组管介入/returned打回未改',
  `remind_date` VARCHAR(10) NOT NULL COMMENT '提醒日期 YYYY-MM-DD（当天不重复）',
  `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
  `change_ts`   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_remind` (`week_key`, `user_id`, `remind_type`, `remind_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周报提醒去重日志';

-- ===== 通知类型注册（通知中心代码零改动，注册后自动支持展示/筛选） =====
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'report_submitted', '周报已提交', 'report', 1, 1, 40
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'report_submitted');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'report_reviewed', '周报已批阅', 'report', 1, 1, 41
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'report_reviewed');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'report_returned', '周报已打回', 'report', 1, 1, 42
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'report_returned');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'report_withdraw', '周报撤回', 'report', 1, 1, 43
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'report_withdraw');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'report_remind', '周报提醒', 'report', 1, 1, 44
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'report_remind');

INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'report_purged', '周报已删除', 'report', 1, 1, 45
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'report_purged');
