-- 课题组会议主表：会议归属课题组，不跨组、不移动。
-- 创建/管理仅超管与课题组管理员，导师/学生只读自己参与的会议。
-- 三种状态：1草稿（仅创建者和本组组管/超管只读可见）、2已发布、3已归档（可取消归档）；
-- 已发布不可回退草稿；归档仅在 2 ↔ 3 之间切换。
-- 发布为公告：notice_id 仅追溯来源，公告写入 group_notice 后独立存在，
-- 删组会不删公告、删公告不改组会；课题组删除时公告与组会一并级联删除。
-- 硬删除：删除会议时由应用级联删除参与人记录。
CREATE TABLE IF NOT EXISTS `group_meeting` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '会议ID',
  `group_id`     BIGINT       NOT NULL COMMENT '所属课题组ID（组删除时级联删除）',
  `title`        VARCHAR(100) NOT NULL COMMENT '会议主题',
  `meeting_time` DATETIME     NOT NULL COMMENT '会议时间',
  `location`     VARCHAR(100) NULL COMMENT '地点',
  `host_id`      BIGINT       NOT NULL COMMENT '发起人用户ID（超管或组管）',
  `agenda`       VARCHAR(2000) NULL COMMENT '议题',
  `content`      TEXT         NULL COMMENT '会议纪要（Markdown 原文，上限 20000 字符）',
  `status`       TINYINT      NOT NULL DEFAULT 1 COMMENT '状态：1草稿，2已发布，3已归档',
  `notice_id`    BIGINT       NULL COMMENT '已发布为公告时记录公告ID（仅追溯用，公告独立存在）',
  `create_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `change_ts`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  KEY `idx_group_id` (`group_id`),
  KEY `idx_meeting_time` (`meeting_time`),
  KEY `idx_host_id` (`host_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题组会议表';
