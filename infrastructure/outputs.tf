output "aws_account_id" {
  description = "AWS account ID used by Terraform."
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS region."
  value       = var.aws_region
}

output "vpc_id" {
  description = "FleetFlow VPC ID."
  value       = aws_vpc.main.id
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS name."
  value       = aws_lb.main.dns_name
}

output "alb_url" {
  description = "HTTP URL for the Application Load Balancer."
  value       = "http://${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "ECR repository URL."
  value       = aws_ecr_repository.driverdashboard.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.main.name
}

output "postgres_endpoint" {
  description = "PostgreSQL RDS endpoint."
  value       = aws_db_instance.postgres.address
}

output "postgres_port" {
  description = "PostgreSQL RDS port."
  value       = aws_db_instance.postgres.port
}

output "cloudwatch_log_group" {
  description = "ECS CloudWatch log group."
  value       = aws_cloudwatch_log_group.ecs.name
}

output "github_actions_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC."
  value       = aws_iam_role.github_actions.arn
}

output "github_actions_oidc_role_arn" {
  description = "IAM role ARN for GitHub Actions OIDC."
  value       = aws_iam_role.github_actions.arn
}

output "database_secret_arn" {
  description = "Secrets Manager ARN for the application database secret."
  value       = aws_secretsmanager_secret.db_secret.arn
}

output "secret_arn" {
  description = "Secrets Manager ARN for the application database secret."
  value       = aws_secretsmanager_secret.db_secret.arn
}
