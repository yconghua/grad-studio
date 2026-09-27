-- 用户-课题组归属表：成员管理核心（一个用户可同时属于多个课题组，组内角色独立记录）
-- 幂等：重复执行无副作用。
-- 说明：用户全局角色（super_admin / group_admin / mentor / student）存于 user.role；
--   用户在某课题组内的身份通过本表 role_in_group 记录（group_admin / mentor / student），
--   「成员管理」按 group_id 过滤本组成员；退出 / 禁用通过 status 表达。
CREATE TABLE IF NOT EXISTS `user_group` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '用户 user.id',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '课题组 group.id',
  `role_in_group` VARCHAR(20)  NOT NULL DEFAULT 'student' COMMENT '组内角色：group_admin 课题组管理员 / mentor 导师 / student 学生',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active 在组 / left 已离组 / disabled 被禁用',
  `joined_at`     DATETIME                             COMMENT '入组时间',
  `left_at`       DATETIME                             COMMENT '离组时间',
  `remark`        VARCHAR(255) NOT NULL DEFAULT ''     COMMENT '备注',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_user_group` (`user_id`, `group_id`),
  KEY `idx_group_role` (`group_id`, `role_in_group`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-课题组归属表';
