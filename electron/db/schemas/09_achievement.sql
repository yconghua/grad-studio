-- 学术成果 / 成果作者关联（模块5 学术成果管理）
-- 附件（PDF、录用通知、检索证明）本期不做上传，故不设文件列。
-- partition 是 MySQL 保留字，列名必须用反引号包裹。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `achievement` (
  `id`                     INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '主键',
  `type`                   VARCHAR(20)   NOT NULL DEFAULT '论文' COMMENT '成果类型：论文 / 专利 / 软著 / 标准 / 获奖 / 竞赛',
  `level`                  VARCHAR(30)   DEFAULT NULL            COMMENT '级别：论文填 SCI / EI / 核心，专利填 发明 / 实用新型 / 外观',
  `title`                  VARCHAR(200)  NOT NULL                COMMENT '成果标题',
  `authors_text`           VARCHAR(255)  DEFAULT NULL            COMMENT '作者排序文本，冗余字段便于列表展示',
  `first_author_id`        INT UNSIGNED  DEFAULT NULL            COMMENT '第一作者 member.id',
  `corresponding_author_id` INT UNSIGNED DEFAULT NULL            COMMENT '通讯作者 member.id',
  `publish_date`           DATE          DEFAULT NULL            COMMENT '发表或授权日期',
  `venue`                  VARCHAR(200)  DEFAULT NULL            COMMENT '期刊或会议名称',
  `volume`                 VARCHAR(50)   DEFAULT NULL            COMMENT '卷',
  `issue`                  VARCHAR(50)   DEFAULT NULL            COMMENT '期',
  `pages`                  VARCHAR(50)   DEFAULT NULL            COMMENT '页码',
  `doi`                    VARCHAR(100)  DEFAULT NULL            COMMENT 'DOI',
  `index_no`               VARCHAR(100)  DEFAULT NULL            COMMENT '检索号',
  `impact_factor`          DECIMAL(6,3)  DEFAULT NULL            COMMENT '影响因子',
  `partition`              VARCHAR(30)   DEFAULT NULL            COMMENT '分区，如 中科院一区',
  `status`                 VARCHAR(20)   NOT NULL DEFAULT '投稿' COMMENT '状态：投稿 / 在审 / 录用 / 发表 / 检索',
  `project_id`             INT UNSIGNED  DEFAULT NULL            COMMENT '关联项目 id，可为空',
  `approval_id`            INT UNSIGNED  DEFAULT NULL            COMMENT '关联审批单 approval_order.id',
  `is_deleted`             TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除：0 正常 / 1 已删除',
  `created_at`             DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`             DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_publish_date` (`publish_date`),
  KEY `idx_first_author` (`first_author_id`),
  KEY `idx_project` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学术成果表';

CREATE TABLE IF NOT EXISTS `achievement_member` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `achievement_id`   INT UNSIGNED NOT NULL                COMMENT '成果 id',
  `member_id`        INT UNSIGNED NOT NULL                COMMENT '成员 id',
  `author_order`     INT          NOT NULL DEFAULT 1      COMMENT '作者位次',
  `is_corresponding` TINYINT      NOT NULL DEFAULT 0      COMMENT '是否通讯作者：0 否 / 1 是',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_achievement_member` (`achievement_id`, `member_id`),
  KEY `idx_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成果作者关联表';
