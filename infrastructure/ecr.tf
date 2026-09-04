resource "aws_ecr_repository" "driverdashboard" {
  name                 = var.ecr_repository_name
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = var.ecr_repository_name
  }
}

resource "aws_ecr_lifecycle_policy" "driverdashboard" {
  repository = aws_ecr_repository.driverdashboard.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the 20 most recently pushed images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
