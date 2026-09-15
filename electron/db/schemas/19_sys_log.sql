-- 操作日志 / 登录日志（模块12 系统管理）
-- 多台电脑共用同一个库，故登录日志记录 machine_name，便于区分是哪台机器登录的。
-- username 与 member_id 都存：账号被删除后仍能凭 username 追溯历史操作。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `sys_log` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '主键',
  `member_id`  INT UNSIGNED  DEFAULT NULL            COMMENT '操作人 member.id',
  `username`   VARCHAR(50)   DEFAULT NULL            COMMENT '操作人账号，冗余字段便于追溯',
  `module`     VARCHAR(40)   DEFAULT NULL            COMMENT '所属模块，如 成员管理 / 设备管理',
  `action`     VARCHAR(40)   DEFAULT NULL            COMMENT '操作动作，如 新增 / 修改 / 删除 / 审批',
  `target`     VARCHAR(150)  DEFAULT NULL            COMMENT '操作对象描述',
  `detail`     VARCHAR(1000) DEFAULT NULL            COMMENT '操作详情',
  `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  PRIMARY KEY (`id`),
  KEY `idx_member` (`member_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

CREATE TABLE IF NOT EXISTS `login_log` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`     VARCHAR(50)  NOT NULL                COMMENT '登录账号，登录失败时账号可能不存在',
  `member_id`    INT UNSIGNED DEFAULT NULL            COMMENT '成员 member.id，仅登录成功时有值',
  `machine_name` VARCHAR(100) DEFAULT NULL            COMMENT '电脑名，用于区分是哪台机器登录',
  `success`      TINYINT      NOT NULL DEFAULT 0      COMMENT '是否成功：0 失败 / 1 成功',
  `message`      VARCHAR(255) DEFAULT NULL            COMMENT '结果提示信息',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  PRIMARY KEY (`id`),
  KEY `idx_username` (`username`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录日志表';
