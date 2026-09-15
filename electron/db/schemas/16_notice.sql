-- 公告 / 可见范围 / 已读记录 / 通知模板（模块10 通知公告）
-- 推送渠道只做站内信（写入 17_message.sql 的 message 表），不接邮件与微信钉钉。
-- notice_scope 命名为 notice_scope 而非 scope，避免与数据库关键字重名带来的转义风险。
-- 幂等：CREATE TABLE IF NOT EXISTS + INSERT IGNORE（靠唯一键去重）。

CREATE TABLE IF NOT EXISTS `notice` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(200) NOT NULL                COMMENT '标题',
  `content`      TEXT         DEFAULT NULL            COMMENT '正文内容',
  `type`         VARCHAR(20)  NOT NULL DEFAULT '公告'  COMMENT '类型：公告 / 系统通知 / 审批提醒 / 截止提醒 / 组会提醒',
  `notice_scope` VARCHAR(20)  NOT NULL DEFAULT '全体'  COMMENT '可见范围：全体 / 指定成员',
  `publisher_id` INT UNSIGNED DEFAULT NULL            COMMENT '发布人 member.id',
  `is_top`       TINYINT      NOT NULL DEFAULT 0      COMMENT '是否置顶：0 否 / 1 是',
  `publish_time` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  `is_deleted`   TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除：0 正常 / 1 已删除',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_publish_time` (`publish_time`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公告表';

CREATE TABLE IF NOT EXISTS `notice_target` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `notice_id`  INT UNSIGNED NOT NULL                COMMENT '公告 id',
  `member_id`  INT UNSIGNED NOT NULL                COMMENT '可见成员 member.id',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notice_member` (`notice_id`, `member_id`),
  KEY `idx_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公告可见范围表';

CREATE TABLE IF NOT EXISTS `notice_read` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `notice_id`  INT UNSIGNED NOT NULL                COMMENT '公告 id',
  `member_id`  INT UNSIGNED NOT NULL                COMMENT '已读成员 member.id',
  `read_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '已读时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notice_member` (`notice_id`, `member_id`),
  KEY `idx_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='公告已读记录表';

CREATE TABLE IF NOT EXISTS `notice_template` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `code`        VARCHAR(40)  NOT NULL                COMMENT '模板编码，唯一',
  `name`        VARCHAR(100) NOT NULL                COMMENT '模板名称',
  `title_tpl`   VARCHAR(200) DEFAULT NULL            COMMENT '标题模板，用花括号占位变量',
  `content_tpl` TEXT         DEFAULT NULL            COMMENT '内容模板，用花括号占位变量',
  `type`        VARCHAR(20)  NOT NULL DEFAULT '系统通知' COMMENT '通知类型',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知模板表';

INSERT IGNORE INTO `notice_template` (`code`, `name`, `title_tpl`, `content_tpl`, `type`) VALUES
('APPROVAL_TODO', '审批待办提醒', '您有一条新的{业务类型}待审批', '{申请人} 于 {提交时间} 提交了「{标题}」，请及时处理。', '审批提醒'),
('APPROVAL_RESULT', '审批结果通知', '您的{业务类型}申请已{审批结果}', '{审批人} 于 {办结时间} {审批结果}了您的申请「{标题}」。审批意见：{审批意见}', '审批提醒'),
('TASK_DEADLINE', '任务截止提醒', '任务「{任务标题}」即将到期', '任务「{任务标题}」的截止时间为 {截止时间}，当前状态：{任务状态}，请及时处理。', '截止提醒'),
('ACTIVITY_REMIND', '组会活动提醒', '组会提醒：{活动主题}', '{活动类型}「{活动主题}」将于 {开始时间} 在 {活动地点} 举行，请准时参加。', '组会提醒'),
('NOTICE_PUBLISH', '公告发布通知', '{公告标题}', '{公告内容}', '系统通知'),
('MEMBER_JOIN', '入组开通通知', '欢迎加入工作室', '{姓名} 同学你好，你的工作室账号已开通，登录账号为 {登录账号}，初始密码请向管理员索取。', '系统通知');
