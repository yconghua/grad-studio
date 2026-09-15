-- 系统用户表：两级权限（admin 管理员 / user 普通用户）
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- v0.1.0 扩展：新增 status / display_name / last_login_at / updated_at 四列。
-- 表已存在时 CREATE 会被跳过，由迁移的「列同步」自动 ALTER TABLE ADD COLUMN 补齐（只加不删）。
-- 故新增列必须带 DEFAULT 或允许 NULL，否则已有数据行会导致 ALTER 失败。
CREATE TABLE IF NOT EXISTS `user` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`      VARCHAR(50)  NOT NULL                COMMENT '登录账号（唯一）',
  `password`      VARCHAR(100) NOT NULL                COMMENT 'bcrypt 哈希后的密码',
  `role`          VARCHAR(20)  NOT NULL DEFAULT 'user' COMMENT '权限：admin 管理员 / user 普通用户',
  `status`        VARCHAR(20)  NOT NULL DEFAULT '启用'  COMMENT '账号状态：启用 / 禁用',
  `display_name`  VARCHAR(50)  DEFAULT NULL            COMMENT '显示名，一般同成员姓名',
  `last_login_at` DATETIME     DEFAULT NULL            COMMENT '最后登录时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- 默认管理员（admin / admin123）：仅在账号不存在时插入，避免重复初始化冲突
INSERT INTO `user` (`username`, `password`, `role`)
SELECT 'admin', '$2b$10$cPHMkHMubQkZDVOi75fpte.kilWcn/2vFqX7muTMvyOlYCDfqx1/C', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM `user` WHERE `username` = 'admin');
