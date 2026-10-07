-- 学生个人学业记录档案：档案节点记录 + 阶段模板（组管可调）
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 设计约定（与方案一致）：
--   - 数据与学生本人挂钩：academic_records.user_id 为归属核心，group_id 仅为按组筛选的冗余；
--     学生删除 → 该表 is_deleted=1（用户删除事务内物理清理附件文件）；
--   - 同一学生同一节点仅一条：UNIQUE(user_id, node_key)；
--   - 模板：group_id=0 为超管维护的全局默认模板（新组/新学生初始套用），
--     组管在本组模板上增删调整；「删除节点」= enabled=0 停用（保留学生已填历史）；
--   - 状态机：pending 待填写 / submitted 已提交待确认 / confirmed 已确认（导师）；
--     退回后回到 pending 可改再提交；
--   - remind_at：定时提醒去重（临近/逾期每 7 天最多提醒一次）。

-- ===== 学业档案记录表 =====
CREATE TABLE IF NOT EXISTS `academic_records` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `user_id`         BIGINT       NOT NULL COMMENT '学生用户ID（归属核心，服务端注入）',
  `group_id`        BIGINT       NOT NULL COMMENT '记录时所在课题组ID（冗余，按组筛选用）',
  `stage_type`      VARCHAR(20)  NOT NULL COMMENT '培养类型：master/doctor/bachelor',
  `node_key`        VARCHAR(50)  NOT NULL COMMENT '阶段节点标识（开题/中期/答辩…，来自模板）',
  `node_name`       VARCHAR(100) NOT NULL COMMENT '节点名称快照（模板改名不影响历史）',
  `plan_date`       DATE         DEFAULT NULL COMMENT '计划时间（模板给的期望时间）',
  `happen_date`     DATE         DEFAULT NULL COMMENT '实际发生时间（空=未完成）',
  `end_date`        DATE         DEFAULT NULL COMMENT '实际结束时间（跨时段节点如课程学习）',
  `content`         TEXT         DEFAULT NULL COMMENT '内容描述（开题内容/论文题目等）',
  `attachment_path` VARCHAR(500) DEFAULT NULL COMMENT '附件文件路径（uploads 下，随学生删除清理）',
  `status`          VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态：pending/submitted/confirmed',
  `reject_reason`   VARCHAR(255) DEFAULT NULL COMMENT '导师退回意见',
  `remind_at`       DATETIME     DEFAULT NULL COMMENT '最近提醒时间（提醒去重：7天内不重复）',
  `created_by`      BIGINT       DEFAULT NULL COMMENT '填写人用户ID（学生本人或导师代填）',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  `is_deleted`      TINYINT      NOT NULL DEFAULT 0 COMMENT '软删除标记：0正常，1已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_node` (`user_id`, `node_key`),
  KEY `idx_user_status` (`user_id`, `status`),
  KEY `idx_group` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生学业档案节点记录';

-- ===== 阶段模板表 =====
CREATE TABLE IF NOT EXISTS `academic_stage_templates` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '模板ID',
  `group_id`   BIGINT       NOT NULL DEFAULT 0 COMMENT '所属课题组；0=全局默认模板（超管维护，新组自动复制）',
  `stage_type` VARCHAR(20)  NOT NULL COMMENT '培养类型：master/doctor/bachelor',
  `node_key`   VARCHAR(50)  NOT NULL COMMENT '节点标识',
  `node_name`  VARCHAR(100) NOT NULL COMMENT '节点名称（组管可改）',
  `sort_order` INT          NOT NULL DEFAULT 0 COMMENT '排序（时间线顺序，小在前）',
  `required`   TINYINT      NOT NULL DEFAULT 0 COMMENT '是否必填：0否，1是',
  `plan_term`  INT          DEFAULT NULL COMMENT '期望学期（第几学期，可空=不限）',
  `enabled`    TINYINT      NOT NULL DEFAULT 1 COMMENT '启用：0停用（隐藏但保留学生已填历史），1启用',
  `created_by` BIGINT       DEFAULT NULL COMMENT '创建人用户ID（组管/超管）',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  `is_deleted` TINYINT      NOT NULL DEFAULT 0 COMMENT '软删除标记：0正常，1已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_type_node` (`group_id`, `stage_type`, `node_key`),
  KEY `idx_group_type` (`group_id`, `stage_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学业阶段模板（组管可调，0=全局默认）';

-- ===== 全局默认模板种子（三套培养类型，仅当 group_id=0 的同类型模板不存在时写入） =====
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'master', 'ruxue', '入学注册', 1, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'master');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'master', 'kecheng', '课程学习', 2, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'master' AND `node_key` = 'kecheng');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'master', 'wenxian', '文献综述', 3, 1, 2, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'master' AND `node_key` = 'wenxian');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'master', 'kaoti', '开题报告', 4, 1, 3, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'master' AND `node_key` = 'kaoti');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'master', 'zhongqi', '中期考核', 5, 1, 4, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'master' AND `node_key` = 'zhongqi');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'master', 'lunwen', '论文撰写', 6, 1, 5, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'master' AND `node_key` = 'lunwen');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'master', 'yudabian', '预答辩', 7, 1, 6, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'master' AND `node_key` = 'yudabian');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'master', 'dabian', '正式答辩', 8, 1, 6, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'master' AND `node_key` = 'dabian');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'master', 'xuewei', '学位申请', 9, 1, 6, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'master' AND `node_key` = 'xuewei');

INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'doctor', 'ruxue', '入学', 1, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'doctor');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'doctor', 'kecheng', '课程', 2, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'doctor' AND `node_key` = 'kecheng');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'doctor', 'kaoti', '开题', 3, 1, 2, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'doctor' AND `node_key` = 'kaoti');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'doctor', 'zhongqi', '中期', 4, 1, 4, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'doctor' AND `node_key` = 'zhongqi');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'doctor', 'xueshu', '学术成果', 5, 1, 5, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'doctor' AND `node_key` = 'xueshu');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'doctor', 'yudabian', '预答辩', 6, 1, 6, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'doctor' AND `node_key` = 'yudabian');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'doctor', 'mangshen', '盲审', 7, 1, 6, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'doctor' AND `node_key` = 'mangshen');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'doctor', 'dabian', '正式答辩', 8, 1, 6, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'doctor' AND `node_key` = 'dabian');

INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'bachelor', 'ruxue', '入学', 1, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'bachelor');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'bachelor', 'kecheng', '课程修读', 2, 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'bachelor' AND `node_key` = 'kecheng');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'bachelor', 'sheji', '毕业设计选题', 3, 1, 3, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'bachelor' AND `node_key` = 'sheji');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'bachelor', 'kaoti', '开题', 4, 1, 3, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'bachelor' AND `node_key` = 'kaoti');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'bachelor', 'zhongjian', '中期检查', 5, 1, 4, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'bachelor' AND `node_key` = 'zhongjian');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'bachelor', 'lunwen', '论文提交', 6, 1, 5, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'bachelor' AND `node_key` = 'lunwen');
INSERT INTO `academic_stage_templates` (`group_id`, `stage_type`, `node_key`, `node_name`, `sort_order`, `required`, `plan_term`, `enabled`)
SELECT 0, 'bachelor', 'dabian', '答辩', 7, 1, 6, 1
WHERE NOT EXISTS (SELECT 1 FROM `academic_stage_templates` WHERE `group_id` = 0 AND `stage_type` = 'bachelor' AND `node_key` = 'dabian');

-- ===== 通知类型注册（提醒去重日志不在本文件，提醒直接以 remind_at 去重） =====
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'academic_remind', '学业节点提醒', 'task', 1, 1, 46
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'academic_remind');

-- 学业节点提交通知（学生提交 → 通知导师确认）
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'academic_submit', '学业节点提交', 'task', 1, 1, 47
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'academic_submit');

-- 学业节点退回通知（导师退回 → 通知学生修改后重交）
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'academic_return', '学业节点退回', 'task', 1, 1, 48
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'academic_return');
