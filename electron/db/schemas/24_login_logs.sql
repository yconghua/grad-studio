-- 登录日志：记录每次进入系统的会话（输密码 / 扫码 / 免密票据恢复），成功与失败都记
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 设计约定：
--   - 纯本地采集，不联网：IP 为局域网 IP，address 为「主机名 · 网卡类型 · IP」组合展示文本；
--   - login_type：password 账号密码 / scan 扫码 / restore 免密票据恢复（切换账号路径）；
--   - status：1 成功 / 0 失败；失败时 user_id 可能为空（账号不存在场景），fail_reason 记原因；
--   - 保留策略：默认保留 90 天（system_configs 键 login_log.retain_days 可配），
--     由主进程每日清理一次过期记录（见 loginLogScheduler）。
--   - 无 change_ts：登录日志只追加 + 定期删除，不参与全局数据版本指纹（避免每次登录都触发全站刷新）。

-- ===== 登录日志表 =====
CREATE TABLE IF NOT EXISTS `login_logs` (
  `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `user_id`     BIGINT       DEFAULT NULL COMMENT '登录用户ID（失败且账号不存在时为空）',
  `username`    VARCHAR(64)  NOT NULL COMMENT '用户名冗余（用户被删后仍可查）',
  `role`        VARCHAR(32)  DEFAULT NULL COMMENT '角色快照：super_admin/group_admin/mentor/student',
  `login_type`  VARCHAR(20)  NOT NULL DEFAULT 'password' COMMENT '登录方式：password/scan/restore',
  `ip`          VARCHAR(64)  DEFAULT NULL COMMENT '局域网 IP',
  `address`     VARCHAR(255) DEFAULT NULL COMMENT '主机名 · 网卡类型 · IP 组合展示文本',
  `status`      TINYINT      NOT NULL DEFAULT 1 COMMENT '1 成功 / 0 失败',
  `fail_reason` VARCHAR(255) DEFAULT NULL COMMENT '失败原因（成功时为空）',
  `login_time`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_time` (`user_id`, `login_time`),
  KEY `idx_login_time` (`login_time`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='登录日志';
