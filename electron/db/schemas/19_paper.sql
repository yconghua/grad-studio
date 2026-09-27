-- 论文投稿跟踪表：论文类成果的投稿全流程跟踪（学生维护）
-- 幂等：重复执行无副作用。
-- 说明：一条记录对应一篇论文，状态流转：
--   drafting 撰写中 → submitted 已投稿 → under_review 在审 → accepted 已录用 → published 已发表；
--   任一阶段可标记 rejected 被拒；字段覆盖投稿关键节点（时间 / 期刊 / DOI / 署名）。
CREATE TABLE IF NOT EXISTS `paper` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `achievement_id` INT UNSIGNED NOT NULL DEFAULT 0     COMMENT '关联成果 achievement.id（0 表示尚未登记成果）',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '归属人 user.id（学生）',
  `title`         VARCHAR(300) NOT NULL                COMMENT '论文标题',
  `authors`       VARCHAR(500) NOT NULL DEFAULT ''     COMMENT '作者列表（按署名顺序）',
  `journal`       VARCHAR(200) NOT NULL DEFAULT ''     COMMENT '投稿期刊',
  `conference`    VARCHAR(200) NOT NULL DEFAULT ''     COMMENT '会议名称（会议论文时填写）',
  `level_desc`    VARCHAR(100) NOT NULL DEFAULT ''     COMMENT '期刊等级 / 分区 / 影响因子描述（如 JCR Q1）',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'drafting' COMMENT '状态：drafting 撰写中 / submitted 已投稿 / under_review 在审 / accepted 已录用 / published 已发表 / rejected 被拒',
  `is_first_author` TINYINT(1) NOT NULL DEFAULT 1      COMMENT '是否第一作者：1 是 / 0 否',
  `submit_date`   DATE                                 COMMENT '投稿日期',
  `accept_date`   DATE                                 COMMENT '录用日期',
  `publish_date`  DATE                                 COMMENT '发表日期',
  `doi`           VARCHAR(100) NOT NULL DEFAULT ''     COMMENT 'DOI 编号',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_achievement` (`achievement_id`),
  KEY `idx_user_status` (`user_id`, `status`),
  KEY `idx_title` (`title`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='论文投稿跟踪表';
