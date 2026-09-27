-- 学位节点定义表：课题组维护的学位培养节点模板（组管 / 导师维护）
-- 幂等：重复执行无副作用。
-- 说明：节点为组内通用定义（如开题报告 / 中期考核 / 预答辩 / 毕业答辩），
--   每位学生针对各节点的完成情况记录在 student_degree 表。
CREATE TABLE IF NOT EXISTS `degree_node` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `group_id`      INT UNSIGNED NOT NULL                COMMENT '所属课题组 group.id',
  `name`          VARCHAR(100) NOT NULL                COMMENT '节点名称（如 开题报告 / 中期考核 / 预答辩 / 毕业答辩）',
  `node_order`    INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '节点顺序（数值小在前）',
  `description`   TEXT                                 COMMENT '节点说明 / 考核要求',
  `is_required`   TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '是否必达：1 必达 / 0 选做',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_group_order` (`group_id`, `node_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='学位节点定义表';
