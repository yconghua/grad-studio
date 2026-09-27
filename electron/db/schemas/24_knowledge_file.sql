-- 知识库文件表：知识库文档节点对应的实际文件
-- 幂等：重复执行无副作用。
-- 说明：一个文档节点（knowledge.node_type='doc'）可挂一个或多个文件版本；
--   download_count 统计下载次数；归档文件通过 status 标记不删除。
CREATE TABLE IF NOT EXISTS `knowledge_file` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `knowledge_id`  INT UNSIGNED NOT NULL                COMMENT '所属知识库节点 knowledge.id',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `title`         VARCHAR(200) NOT NULL                COMMENT '文件标题',
  `file_path`     VARCHAR(255) DEFAULT NULL     COMMENT '存储路径',
  `file_size`     INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '文件大小（字节）',
  `file_type`     VARCHAR(50)  DEFAULT NULL     COMMENT '文件类型（如 pdf / docx / xlsx / png）',
  `uploaded_by`   INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '上传人 user.id',
  `download_count` INT UNSIGNED NOT NULL DEFAULT 0     COMMENT '下载次数',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active 生效 / archived 已归档',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_knowledge` (`knowledge_id`),
  KEY `idx_group` (`group_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识库文件表';
