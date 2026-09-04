resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.task_family}"
  retention_in_days = var.log_retention_in_days

  tags = {
    Name = "/ecs/${var.task_family}"
  }
}
