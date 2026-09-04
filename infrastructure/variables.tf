variable "aws_region" {
  description = "AWS region for infrastructure deployment."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name."
  type        = string
  default     = "terraform-test"
}

variable "project_name" {
  description = "Project name used in resource names and tags."
  type        = string
  default     = "fleetflow"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Two Availability Zones used by the application."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]

  validation {
    condition     = length(var.availability_zones) == 2
    error_message = "Exactly two Availability Zones are required."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDRs for public subnets."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_app_subnet_cidrs" {
  description = "CIDRs for ECS application subnets."
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "private_db_subnet_cidrs" {
  description = "CIDRs for PostgreSQL database subnets."
  type        = list(string)
  default     = ["10.0.20.0/24", "10.0.21.0/24"]
}

variable "ecr_repository_name" {
  description = "ECR repository name."
  type        = string
  default     = "driverdashboard-terraform-test"
}

variable "db_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "driverdatabase1"
}

variable "db_master_username" {
  description = "PostgreSQL master username."
  type        = string
  default     = "dbadmin"
}

variable "db_engine_version" {
  description = "PostgreSQL engine version."
  type        = string
  default     = "15.19"
}

variable "db_instance_class" {
  description = "PostgreSQL RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "db_backup_retention_period" {
  description = "PostgreSQL backup retention period in days."
  type        = number
  default     = 1
}

variable "ecs_cluster_name" {
  description = "ECS cluster name."
  type        = string
  default     = "fleetflow-terraform-test-cluster"
}

variable "ecs_service_name" {
  description = "ECS service name."
  type        = string
  default     = "fleetflow-terraform-test-service"
}

variable "task_family" {
  description = "ECS task definition family."
  type        = string
  default     = "fleetflow-terraform-test-task"
}

variable "container_name" {
  description = "Container name."
  type        = string
  default     = "fleetflow"
}

variable "container_port" {
  description = "FastAPI container port."
  type        = number
  default     = 8000
}

variable "ecs_cpu" {
  description = "Fargate CPU units."
  type        = number
  default     = 512
}

variable "ecs_memory" {
  description = "Fargate memory in MB."
  type        = number
  default     = 1024
}

variable "desired_task_count" {
  description = "Initial ECS desired task count."
  type        = number
  default     = 1
}

variable "min_task_count" {
  description = "Minimum ECS task count for autoscaling."
  type        = number
  default     = 1
}

variable "max_task_count" {
  description = "Maximum ECS task count for autoscaling."
  type        = number
  default     = 3
}

variable "autoscaling_cpu_target" {
  description = "Target average ECS service CPU percentage."
  type        = number
  default     = 60
}

variable "log_retention_in_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 30
}

variable "github_repo" {
  description = "GitHub repository in owner/repository format."
  type        = string
  default     = "RohitAnkolnerkar/Driver_management_system"
}

variable "github_branch" {
  description = "GitHub branch allowed to assume the deployment role."
  type        = string
  default     = "master"
}

variable "bootstrap_image" {
  description = "Temporary public image used so the ECS service can be created before the first GitHub Actions image push."
  type        = string
  default     = "public.ecr.aws/docker/library/python:3.12-slim"
}

variable "enable_container_insights" {
  description = "Enable ECS Container Insights."
  type        = bool
  default     = true
}

variable "create_github_oidc_provider" {
  description = "Whether to create the GitHub OIDC provider resource in IAM. Set to false if it already exists in the AWS account."
  type        = bool
  default     = true
}

