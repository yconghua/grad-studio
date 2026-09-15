-- 预算 / 报销申请 / 账目流水（模块9 经费与报销）
-- 金额一律 DECIMAL(12,2)，绝不用 FLOAT，浮点算钱会出错。
-- balance_after 在 Service 层用 runTransaction 事务内计算并写入，保证多台电脑并发记账时不串数。
-- 报销审批走统一审批单，本文件只存 approval_id 关联。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `budget` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '主键',
  `project_id`  INT UNSIGNED  NOT NULL                COMMENT '项目 id',
  `category`    VARCHAR(30)   NOT NULL DEFAULT '其他'  COMMENT '预算类别：设备 / 材料 / 差旅 / 会议 / 版面费 / 其他',
  `amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00   COMMENT '预算金额',
  `budget_year` VARCHAR(10)   DEFAULT NULL            COMMENT '预算年度，如 2026',
  `note`        VARCHAR(255)  DEFAULT NULL            COMMENT '备注',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_project_cat_year` (`project_id`, `category`, `budget_year`),
  KEY `idx_project` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目预算表';

CREATE TABLE IF NOT EXISTS `expense_apply` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '主键',
  `member_id`   INT UNSIGNED  NOT NULL                COMMENT '申请人 member.id',
  `project_id`  INT UNSIGNED  DEFAULT NULL            COMMENT '关联项目 id',
  `category`    VARCHAR(30)   NOT NULL DEFAULT '其他'  COMMENT '报销类别',
  `amount`      DECIMAL(12,2) NOT NULL DEFAULT 0.00   COMMENT '报销金额',
  `reason`      VARCHAR(500)  DEFAULT NULL            COMMENT '报销事由',
  `apply_date`  DATE          DEFAULT NULL            COMMENT '申请日期',
  `approval_id` INT UNSIGNED  DEFAULT NULL            COMMENT '关联审批单 approval_order.id',
  `status`      VARCHAR(20)   NOT NULL DEFAULT '待审批' COMMENT '状态：待审批 / 已通过 / 已驳回 / 已入账 / 已撤销',
  `created_at`  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_member` (`member_id`),
  KEY `idx_project` (`project_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报销申请表';

CREATE TABLE IF NOT EXISTS `expense_record` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '主键',
  `project_id`    INT UNSIGNED  NOT NULL                COMMENT '项目 id',
  `record_type`   VARCHAR(10)   NOT NULL DEFAULT '支出'  COMMENT '类型：收入 / 支出',
  `category`      VARCHAR(30)   DEFAULT NULL            COMMENT '类别',
  `amount`        DECIMAL(12,2) NOT NULL DEFAULT 0.00   COMMENT '金额，正数',
  `balance_after` DECIMAL(12,2) NOT NULL DEFAULT 0.00   COMMENT '记账后项目余额，冗余字段避免每次求和',
  `biz_type`      VARCHAR(20)   NOT NULL DEFAULT '手动入账' COMMENT '来源：报销 / 手动入账',
  `biz_id`        INT UNSIGNED  DEFAULT NULL            COMMENT '来源业务主键',
  `record_date`   DATE          DEFAULT NULL            COMMENT '记账日期',
  `operator_id`   INT UNSIGNED  DEFAULT NULL            COMMENT '记账人 member.id',
  `remark`        VARCHAR(255)  DEFAULT NULL            COMMENT '备注',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_project` (`project_id`),
  KEY `idx_record_date` (`record_date`),
  KEY `idx_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目账目流水表';
