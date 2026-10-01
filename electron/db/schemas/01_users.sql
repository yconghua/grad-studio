-- 系统用户表：账号、角色、个人档案与课题组归属（用户体系核心表）
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 字段范围：登录认证（username / password_hash / role / status / must_change_password）
--   + 个人档案（real_name / email / phone / gender / avatar）
--   + 归属关系（group_id 所属课题组 / mentor_id 学生对应导师）。
-- 说明：学生、导师、课题组管理员均只属于一个课题组（group_id 单值）；
--   一个学生只有一个导师（mentor_id 单值）；
--   用户名区分大小写（username 列排序规则 utf8mb4_bin）。
CREATE TABLE IF NOT EXISTS `users` (
  `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username`      VARCHAR(50)  NOT NULL COLLATE utf8mb4_bin COMMENT '用户名（区分大小写，唯一）',
  `password_hash` VARCHAR(255) NOT NULL COMMENT '密码哈希（bcrypt）',
  `real_name`     VARCHAR(50)  DEFAULT NULL COMMENT '真实姓名',
  `role`          VARCHAR(20)  NOT NULL COMMENT '角色：super_admin/group_admin/mentor/student',
  `status`        TINYINT      NOT NULL DEFAULT 1 COMMENT '状态：1启用，0禁用',
  `email`         VARCHAR(100) DEFAULT NULL COMMENT '邮箱',
  `phone`         VARCHAR(20)  DEFAULT NULL COMMENT '手机号',
  `gender`        TINYINT      DEFAULT 0 COMMENT '性别：0未知，1男，2女',
  `avatar`        VARCHAR(255) DEFAULT NULL COMMENT '头像',
  `group_id`      BIGINT       DEFAULT NULL COMMENT '所属课题组ID',
  `mentor_id`     BIGINT       DEFAULT NULL COMMENT '学生对应导师用户ID',
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否必须修改初始密码：1首次登录强制改密/0已修改',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_status` (`status`),
  KEY `idx_group` (`group_id`),
  KEY `idx_mentor` (`mentor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- 初始化唯一超级管理员（superadmin / SuperAdmin123）：仅当不存在 super_admin 角色时写入。
-- must_change_password 默认 1 → 首次登录强制修改密码。
INSERT INTO `users` (`username`, `password_hash`, `role`, `real_name`)
SELECT 'superadmin', '$2a$10$lc8GHwTQ050TX1P.dLif9unHkgrSvIvMERR8Nn99VjWeYjUrvwBVi', 'super_admin', '超级管理员'
WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `role` = 'super_admin');
