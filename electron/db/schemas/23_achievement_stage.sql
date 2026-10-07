-- 科研成果「时间进度」：节点模板 + 成果节点时间记录
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 设计约定（与学业档案同模式）：
--   - 节点模板 achievement_stage_templates：group_id=0 为超管全局模板；>0 为课题组快照
--     （课题组创建时从全局整批拷贝，之后组管全权管理本组，超管改全局不再影响已建组）；
--   - 节点记录 achievement_stage_records：成果 × 节点 的时间记录，学生填写、导师审核
--     （pending 待填写 / submitted 待确认 / confirmed 已确认；退回后回 pending 可改再提交）；
--     组管/超管只读；填写人 created_by 与学生归属区分（学生本人填写，防止与成果代填人混淆）；
--   - change_ts：行变更时间戳（全局刷新指纹检测用）。

-- ===== 成果节点模板表 =====
CREATE TABLE IF NOT EXISTS `achievement_stage_templates` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '模板节点ID',
  `group_id`    BIGINT       NOT NULL COMMENT '范围：0=超管全局；>0=课题组快照',
  `type`        VARCHAR(20)  NOT NULL COMMENT '成果类型：paper/patent/software/award/project/other',
  `node_key`    VARCHAR(50)  NOT NULL COMMENT '节点标识（如 submit 投稿）',
  `node_name`   VARCHAR(100) NOT NULL COMMENT '节点名称（如 投稿/初审通过）',
  `sort_order`  INT          NOT NULL DEFAULT 0 COMMENT '排序（升序）',
  `enabled`     TINYINT      NOT NULL DEFAULT 1 COMMENT '是否启用：0停用（学生时间线隐藏，已填历史保留）',
  `is_deleted`  TINYINT      NOT NULL DEFAULT 0 COMMENT '软删除标记',
  `change_ts`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_type_node` (`group_id`, `type`, `node_key`),
  KEY `idx_group_type` (`group_id`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研成果节点模板';

-- ===== 成果节点时间记录表 =====
CREATE TABLE IF NOT EXISTS `achievement_stage_records` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `achievement_id` BIGINT       NOT NULL COMMENT '所属成果ID',
  `node_key`       VARCHAR(50)  NOT NULL COMMENT '节点标识',
  `node_name`      VARCHAR(100) NOT NULL COMMENT '节点名称快照（模板改名不影响历史）',
  `type`           VARCHAR(20)  NOT NULL COMMENT '成果类型快照',
  `group_id`       BIGINT       NOT NULL COMMENT '成果所属课题组快照',
  `happen_date`    DATE         DEFAULT NULL COMMENT '到达该节点的时间（学生填写）',
  `remark`         VARCHAR(500) DEFAULT NULL COMMENT '备注（可空）',
  `status`         VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态：pending待提交/submitted待确认/confirmed已确认',
  `reject_reason`  VARCHAR(255) DEFAULT NULL COMMENT '导师退回意见',
  `created_by`     BIGINT       NOT NULL COMMENT '填写人（学生本人）',
  `reviewed_by`    BIGINT       DEFAULT NULL COMMENT '审核人（导师）',
  `reviewed_at`    DATETIME     DEFAULT NULL COMMENT '审核时间',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_achievement_node` (`achievement_id`, `node_key`),
  KEY `idx_achievement` (`achievement_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研成果节点时间记录';

-- ===== 超管全局默认节点（论文投稿等流程节点） =====
-- 论文：投稿 → 初审通过 → 外审 → 返修 → 录用
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'paper', 'submit', '投稿', 1, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'paper' AND node_key = 'submit');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'paper', 'preliminary', '初审通过', 2, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'paper' AND node_key = 'preliminary');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'paper', 'external_review', '外审', 3, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'paper' AND node_key = 'external_review');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'paper', 'revision', '返修', 4, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'paper' AND node_key = 'revision');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'paper', 'accepted', '录用', 5, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'paper' AND node_key = 'accepted');

-- 专利：申请 → 受理 → 实质审查 → 授权
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'patent', 'apply', '申请', 1, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'patent' AND node_key = 'apply');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'patent', 'accept', '受理', 2, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'patent' AND node_key = 'accept');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'patent', 'substantive_review', '实质审查', 3, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'patent' AND node_key = 'substantive_review');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'patent', 'grant', '授权', 4, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'patent' AND node_key = 'grant');

-- 软著：登记申请 → 受理 → 下证
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'software', 'register', '登记申请', 1, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'software' AND node_key = 'register');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'software', 'accept', '受理', 2, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'software' AND node_key = 'accept');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'software', 'certificate', '下证', 3, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'software' AND node_key = 'certificate');

-- 获奖：申报 → 评审 → 获奖
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'award', 'declare', '申报', 1, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'award' AND node_key = 'declare');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'award', 'review', '评审', 2, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'award' AND node_key = 'review');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'award', 'won', '获奖', 3, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'award' AND node_key = 'won');

-- 项目：申报 → 立项 → 中期检查 → 结题
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'project', 'declare', '申报', 1, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'project' AND node_key = 'declare');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'project', 'approved', '立项', 2, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'project' AND node_key = 'approved');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'project', 'midterm', '中期检查', 3, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'project' AND node_key = 'midterm');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'project', 'complete', '结题', 4, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'project' AND node_key = 'complete');

-- 其他：开始 → 进展 → 完成
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'other', 'start', '开始', 1, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'other' AND node_key = 'start');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'other', 'progress', '进展', 2, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'other' AND node_key = 'progress');
INSERT INTO `achievement_stage_templates` (`group_id`, `type`, `node_key`, `node_name`, `sort_order`, `enabled`, `is_deleted`)
SELECT 0, 'other', 'complete', '完成', 3, 1, 0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `achievement_stage_templates` WHERE group_id = 0 AND type = 'other' AND node_key = 'complete');

-- ===== 通知类型注册 =====
-- 节点提交通知（学生提交节点时间 → 通知导师审核）
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'achievement_stage_submit', '成果进度提交', 'task', 1, 1, 51
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'achievement_stage_submit');

-- 节点退回通知（导师退回 → 通知学生修改后重提）
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'achievement_stage_return', '成果进度退回', 'task', 1, 1, 52
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'achievement_stage_return');
