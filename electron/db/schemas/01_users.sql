-- 系统用户表：两级权限（admin 管理员 / user 普通用户）
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
CREATE TABLE IF NOT EXISTS `user` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`   VARCHAR(50)  NOT NULL                COMMENT '登录账号（唯一）',
  `password`   VARCHAR(100) NOT NULL                COMMENT 'bcrypt 哈希后的密码',
  `role`       VARCHAR(20)  NOT NULL DEFAULT 'user' COMMENT '权限：admin 管理员 / user 普通用户',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- 默认管理员（admin / admin123）：仅在账号不存在时插入，避免重复初始化冲突
INSERT INTO `user` (`username`, `password`, `role`)
SELECT 'admin', '$2b$10$cPHMkHMubQkZDVOi75fpte.kilWcn/2vFqX7muTMvyOlYCDfqx1/C', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM `user` WHERE `username` = 'admin');
