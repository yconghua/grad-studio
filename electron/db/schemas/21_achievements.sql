-- 学生科研成果：成果记录（论文 / 专利 / 软著 / 获奖 / 项目等）
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 设计约定（与学业档案一致）：
--   - 数据与学生本人挂钩：achievements.user_id 为归属核心，group_id 仅为按组筛选的冗余；
--     学生删除 → 该表 is_deleted=1（用户删除事务内物理清理附件文件）；
--   - 状态机：pending 待填写 / submitted 已提交待确认 / confirmed 已确认（导师）；
--     退回后回到 pending 可改再提交；
--   - change_ts：行变更时间戳（全局刷新指纹检测用）。

-- ===== 科研成果记录表 =====
CREATE TABLE IF NOT EXISTS `achievements` (
  `id`              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '成果ID',
  `user_id`         BIGINT       NOT NULL COMMENT '学生用户ID（归属核心，服务端注入）',
  `group_id`        BIGINT       NOT NULL COMMENT '填写时所在课题组ID（冗余，按组筛选用）',
  `type`            VARCHAR(20)  NOT NULL COMMENT '成果类型：paper论文/patent专利/software软著/award获奖/project项目/other其他',
  `title`           VARCHAR(200) NOT NULL COMMENT '成果名称/论文题目',
  `venue`           VARCHAR(200) DEFAULT NULL COMMENT '发表载体：期刊/会议/授权机构名称',
  `level`           VARCHAR(50)  DEFAULT NULL COMMENT '级别：如 SCI一区/EI/核心/普刊；发明专利/实用新型；国家级/省部级/校级',
  `authors`         VARCHAR(500) DEFAULT NULL COMMENT '作者列表文本（如：张三(1)，李四(2)，1为本人）',
  `is_first`        TINYINT      NOT NULL DEFAULT 0 COMMENT '是否第一作者/第一完成人：0否，1是',
  `publish_date`    DATE         DEFAULT NULL COMMENT '发表/授权/获奖日期',
  `description`     TEXT         DEFAULT NULL COMMENT '成果说明/备注',
  `attachment_path` VARCHAR(500) DEFAULT NULL COMMENT '附件文件路径（uploads 下，随学生删除清理）',
  `status`          VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态：pending/submitted/confirmed',
  `reject_reason`   VARCHAR(255) DEFAULT NULL COMMENT '导师退回意见',
  `created_by`      BIGINT       DEFAULT NULL COMMENT '填写人用户ID（学生本人或导师/超管代填）',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  `is_deleted`      TINYINT      NOT NULL DEFAULT 0 COMMENT '软删除标记：0正常，1已删除',
  PRIMARY KEY (`id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_group` (`group_id`),
  KEY `idx_type` (`type`),
  KEY `idx_user_status` (`user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生科研成果记录';

-- ===== 通知类型注册 =====
-- 成果提交通知（学生提交 → 通知导师确认）
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'achievement_submit', '成果提交', 'task', 1, 1, 49
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'achievement_submit');

-- 成果退回通知（导师退回 → 通知学生修改后重交）
INSERT INTO `notification_type` (`type_key`, `display_name`, `icon_key`, `allow_system_notify`, `enabled`, `sort_order`)
SELECT 'achievement_return', '成果退回', 'task', 1, 1, 50
WHERE NOT EXISTS (SELECT 1 FROM `notification_type` WHERE `type_key` = 'achievement_return');
