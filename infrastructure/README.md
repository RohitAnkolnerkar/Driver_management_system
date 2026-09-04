# FleetFlow AWS Infrastructure

Terraform configuration for recreating the FleetFlow / Driver Management System AWS infrastructure.

## Architecture

Internet -> ALB -> ECS Fargate -> PostgreSQL RDS

GitHub Actions -> ECR -> ECS

Terraform creates:

- VPC
- Internet Gateway
- Public, private application, and private database subnets
- NAT Gateway
- Route tables
- Security groups
- ECR
- IAM roles and GitHub Actions OIDC
- Secrets Manager
- PostgreSQL RDS instance
- Application Load Balancer
- ECS Fargate cluster/service/task definition
- CloudWatch logs
- ECS CPU autoscaling

## Bootstrap behavior

The first Terraform apply uses a public Python image only so the ECS service can be created before the first application image exists in the new ECR repository.

After Terraform succeeds:

1. Configure the GitHub Actions repository to use the output `github_actions_role_arn`.
2. Push to `master`.
3. GitHub Actions builds and pushes the real application image to ECR.
4. GitHub Actions updates the ECS task definition and service.

The ECS service ignores Terraform changes to `task_definition` after bootstrap so CI/CD owns application image revisions.

## Commands

```bash
terraform init
terraform fmt -recursive
terraform validate
terraform plan
terraform apply
```

Check the AWS account before applying:

```bash
aws sts get-caller-identity
```

Destroy only when you intentionally want to remove the environment:

```bash
terraform destroy
```

## Important

Terraform state contains sensitive database credentials because the Aurora password and generated Secrets Manager value are managed by Terraform. Do not commit state to Git. Before treating this as production infrastructure, migrate state to a protected, encrypted remote backend with restricted access.
