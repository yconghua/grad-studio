-- 课题组知识库目录表：知识库文件夹 / 文档节点（树形结构）
-- 幂等：重复执行无副作用。
-- 说明：parent_id 实现多级目录（0 表示一级节点）；node_type 区分文件夹与文档，
--   文档的实际文件信息存 knowledge_file 表；组管 / 导师可维护，学生只读。
CREATE TABLE IF NOT EXISTS `knowledge` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `parent_id`     INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '父节点 id（0 为根）',
  `name`          VARCHAR(200) NOT NULL                COMMENT '节点名称（文件夹名 / 文档标题）',
  `node_type`     VARCHAR(20)  NOT NULL DEFAULT 'folder' COMMENT '类型：folder 文件夹 / doc 文档',
  `description`   VARCHAR(500) NOT NULL DEFAULT ''     COMMENT '说明',
  `sort_order`    INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '排序（数值小在前）',
  `created_by`    INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '创建人 user.id',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_group_parent` (`group_id`, `parent_id`),
  KEY `idx_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题组知识库目录表';
