-- 通知中心表：聚合各业务模块产生的通知（当前：公告 notice / 组会 meeting）
-- 重要边界：本表不承载一对一聊天消息！
--   聊天消息由 chat_message + ChatPoller 独立闭环（实时推送 2s 轮询、未读按会话锚点、
--   删除按单删标记/双删硬删），通知中心对聊天零感知，聊天不产生本表记录。
-- 幂等：重复执行无副作用。
-- group_id 可空：仅「按组传播且需随组删除」的通知（公告/组会）写入；
--   与组无关的通知（如未来任务）不写，删除课题组时不级联。
-- 通知状态：is_read 0未读/1已读；is_deleted 0正常/1已删除（软删，级联硬删由应用层事务处理）。
CREATE TABLE IF NOT EXISTS `notification` (
  `id`           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '通知ID',
  `recipient_id` BIGINT       NOT NULL COMMENT '接收人ID（只能查看自己的）',
  `type_key`     VARCHAR(32)  NOT NULL COMMENT '通知类型标识（查 notification_type 注册表）',
  `title`        VARCHAR(100) NOT NULL COMMENT '标题（≤100字符）',
  `summary`      VARCHAR(200) NOT NULL DEFAULT '' COMMENT '摘要（≤200字符，只显示摘要不含敏感信息）',
  `biz_type`     VARCHAR(32)  NOT NULL COMMENT '关联业务类型（notice/meeting/…，用于跳转与级联）',
  `biz_id`       BIGINT       NOT NULL COMMENT '关联业务ID（用于跳转与级联）',
  `group_id`     BIGINT       DEFAULT NULL COMMENT '所属课题组（可空：公告/组会写入，删除课题组级联硬删用）',
  `is_read`      TINYINT      NOT NULL DEFAULT 0 COMMENT '是否已读：0未读，1已读',
  `is_deleted`   TINYINT      NOT NULL DEFAULT 0 COMMENT '是否已删除（软删）：0正常，1已删除',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `read_at`      DATETIME     DEFAULT NULL COMMENT '已读时间',
  `change_ts`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  KEY `idx_recipient` (`recipient_id`, `id`),
  KEY `idx_biz` (`biz_type`, `biz_id`),
  KEY `idx_group` (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知中心表（聊天消息不进入本表）';
