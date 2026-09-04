resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_secret" {
  name                    = "${var.project_name}/${var.environment}/database"
  description             = "FleetFlow PostgreSQL application credentials."
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}/${var.environment}/database"
  }
}

resource "aws_secretsmanager_secret_version" "db_secret" {
  secret_id = aws_secretsmanager_secret.db_secret.id

  secret_string = jsonencode({
    username = var.db_master_username
    password = random_password.db.result
    host     = aws_db_instance.postgres.address
    port     = aws_db_instance.postgres.port
    database = var.db_name
    engine   = "postgres"
  })
}
