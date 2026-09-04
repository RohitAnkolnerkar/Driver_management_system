resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project_name}-${var.environment}-db-subnet-group"
  subnet_ids = aws_subnet.private_db[*].id

  tags = {
    Name = "${var.project_name}-${var.environment}-db-subnet-group"
  }
}

resource "aws_db_parameter_group" "postgres" {
  name        = "${var.project_name}-${var.environment}-postgres15"
  family      = "postgres15"
  description = "FleetFlow PostgreSQL 15 database parameters."

  parameter {
    name  = "timezone"
    value = "UTC"
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "${var.project_name}-${var.environment}-db"
  engine                 = "postgres"
  engine_version         = var.db_engine_version
  instance_class         = var.db_instance_class
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  storage_encrypted      = true
  db_name                = var.db_name
  username               = var.db_master_username
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  parameter_group_name   = aws_db_parameter_group.postgres.name
  vpc_security_group_ids = [aws_security_group.postgres.id]

  backup_retention_period = var.db_backup_retention_period
  multi_az                = false
  publicly_accessible     = false
  deletion_protection     = false
  skip_final_snapshot     = true

  tags = {
    Name = "${var.project_name}-${var.environment}-db"
  }
}
