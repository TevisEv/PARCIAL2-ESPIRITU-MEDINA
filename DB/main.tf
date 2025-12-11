terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# 1️⃣ Grupo de subredes (donde estará el RDS)
resource "aws_db_subnet_group" "postgres_subnet" {
  name        = "usuarios-db-subnet-group"      # nombre NUEVO
  subnet_ids  = var.private_subnets
  description = "Subredes privadas para la base de datos PostgreSQL de usuarios"
}

# 2️⃣ Security Group del RDS
resource "aws_security_group" "rds_sg" {
  name        = "usuarios-db-sg"                # nombre NUEVO
  description = "Permitir acceso al RDS PostgreSQL de usuarios"
  vpc_id      = var.vpc_id

  # ⚠️ Solo para pruebas. Luego cambia 0.0.0.0/0 por tu IP o el SG de tu app
  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# 3️⃣ Instancia de base de datos PostgreSQL
resource "aws_db_instance" "postgres" {
  identifier              = "usuarios-db"       # identificador del RDS
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = "db.t3.micro"
  allocated_storage       = 20
  storage_type            = "gp3"

  username                = var.db_user
  password                = var.db_password
  db_name                 = "usuariosdb"        # nombre de la BD dentro de Postgres
  port                    = 5432

  publicly_accessible     = true                # para pruebas; en prod mejor false
  multi_az                = false
  skip_final_snapshot     = true

  vpc_security_group_ids  = [aws_security_group.rds_sg.id]
  db_subnet_group_name    = aws_db_subnet_group.postgres_subnet.name

  backup_retention_period = 1
  deletion_protection     = false

  tags = {
    Name = "usuariosdb"
  }
}

