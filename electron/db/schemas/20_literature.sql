-- 文献库表：学生个人文献管理（文献与笔记页）
-- 幂等：重复执行无副作用。
-- 说明：支持录入 / 导入文献元数据与本地文件；read_status 标记阅读状态，
--   rating 为个人评分；阅读笔记单独存 literature_note 表。
CREATE TABLE IF NOT EXISTS `literature` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '归属人 user.id（学生）',
  `title`         VARCHAR(300) NOT NULL                COMMENT '文献标题',
  `authors`       VARCHAR(500) DEFAULT NULL     COMMENT '作者列表',
  `source`        VARCHAR(200) DEFAULT NULL     COMMENT '来源（期刊 / 会议 / 书籍名称）',
  `source_type`   VARCHAR(20)  NOT NULL DEFAULT 'journal' COMMENT '来源类型：journal 期刊 / conference 会议 / book 书籍 / other 其他',
  `year`          SMALLINT UNSIGNED                    COMMENT '发表年份',
  `doi`           VARCHAR(100) DEFAULT NULL     COMMENT 'DOI 编号',
  `url`           VARCHAR(500) DEFAULT NULL     COMMENT '原文链接',
  `file_path`     VARCHAR(255) DEFAULT NULL     COMMENT '本地文件路径',
  `tags`          VARCHAR(255) DEFAULT NULL     COMMENT '标签（逗号分隔）',
  `abstract`      TEXT                                 COMMENT '摘要',
  `read_status`   VARCHAR(20)  NOT NULL DEFAULT 'unread' COMMENT '阅读状态：unread 未读 / reading 在读 / read 已读',
  `rating`        TINYINT UNSIGNED                     COMMENT '个人评分（1-5）',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_user_status` (`user_id`, `read_status`),
  KEY `idx_user_source` (`user_id`, `source_type`),
  KEY `idx_title` (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文献库表';
