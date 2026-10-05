-- 学生私人笔记：仅学生角色且已入组（有课题组、有导师）可用的私有草稿本
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 字段约定（与全项目一致）：
--   - 软删除：is_deleted=0 正常 / 1 回收站，进入回收站写入 deleted_at，恢复时清零；
--   - version 为乐观锁版本号：更新必须带版本条件（冲突抛「笔记已被其他设备更新」）；
--   - created_at / change_ts 由数据库生成，客户端不可修改（服务端忽略前端传入值）。
--   - content 用 LONGTEXT：支持最大 100000 字的 Markdown 内容（TEXT 上限不够）。
CREATE TABLE IF NOT EXISTS `note` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '笔记ID',
  `user_id`    BIGINT       NOT NULL COMMENT '所属用户ID（服务端注入，客户端不可传）',
  `title`      VARCHAR(120) NOT NULL DEFAULT '' COMMENT '主题，1-120字',
  `category`   VARCHAR(20)  NOT NULL DEFAULT 'other' COMMENT '类别枚举：experiment/literature/meeting/idea/failure/weekly/project/other',
  `content`    LONGTEXT     NOT NULL COMMENT '内容（Markdown，最长100000字，允许空）',
  `version`    INT          NOT NULL DEFAULT 0 COMMENT '乐观锁版本号（写操作必须带版本条件）',
  `is_deleted` TINYINT      NOT NULL DEFAULT 0 COMMENT '软删除标记：0正常，1回收站',
  `deleted_at` DATETIME     DEFAULT NULL COMMENT '进入回收站时间（软删写入，恢复清零）',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间（服务端生成）',
  `change_ts`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  KEY `idx_user_deleted_updated` (`user_id`, `is_deleted`, `change_ts`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学生私人笔记';
