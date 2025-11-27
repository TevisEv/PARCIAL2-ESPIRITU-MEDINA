##############################
# 1. Crear cluster EKS
##############################

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = var.cluster_name
  cluster_version = "1.29"

  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnet_ids

  eks_managed_node_groups = {
    default = {
      desired_size = 2
      max_size     = 3
      min_size     = 1

      instance_types = ["t3.medium"]
    }
  }
}

##############################
# 2. Provider Kubernetes apuntando al EKS recién creado
##############################

data "aws_eks_cluster" "cluster" {
  name = module.eks.cluster_name
}

data "aws_eks_cluster_auth" "cluster" {
  name = module.eks.cluster_name
}

provider "kubernetes" {
  host = data.aws_eks_cluster.cluster.endpoint

  cluster_ca_certificate = base64decode(
    data.aws_eks_cluster.cluster.certificate_authority[0].data
  )

  token = data.aws_eks_cluster_auth.cluster.token

  # Asegura que el cluster exista antes de usarlo
  alias = "eks"
}

##############################
# 3. Recursos Kubernetes (namespace, secrets, configmap, deployments, services)
##############################

# Namespace
resource "kubernetes_namespace" "unas_tasks" {
  provider = kubernetes.eks

  metadata {
    name = var.namespace
  }
}

# Secret de DB
resource "kubernetes_secret" "db" {
  provider = kubernetes.eks

  metadata {
    name      = "db-credentials"
    namespace = kubernetes_namespace.unas_tasks.metadata[0].name
  }

  data = {
    POSTGRES_USER     = base64encode(var.db_user)
    POSTGRES_PASSWORD = base64encode(var.db_password)
    POSTGRES_DB       = base64encode(var.db_name)
  }

  type = "Opaque"
}

# Secret de JWT
resource "kubernetes_secret" "jwt" {
  provider = kubernetes.eks

  metadata {
    name      = "jwt-secret"
    namespace = kubernetes_namespace.unas_tasks.metadata[0].name
  }

  data = {
    JWT_SECRET     = base64encode(var.jwt_secret)
    JWT_EXPIRES_IN = base64encode(var.jwt_expires_in)
  }

  type = "Opaque"
}

# ConfigMap con init.sql (users, auth_tokens, tasks)
resource "kubernetes_config_map" "db_init" {
  provider = kubernetes.eks

  metadata {
    name      = "db-init-sql"
    namespace = kubernetes_namespace.unas_tasks.metadata[0].name
  }

  data = {
    "init.sql" = <<-EOT
      -- Habilitar pgcrypto para usar crypt()
        CREATE EXTENSION IF NOT EXISTS pgcrypto;

        -- Borrar tablas si existen (orden correcto por FK)
        DROP TABLE IF EXISTS tasks;
        DROP TABLE IF EXISTS auth_tokens;
        DROP TABLE IF EXISTS teacher_groups;
        DROP TABLE IF EXISTS users;
        DROP TABLE IF EXISTS groups;

        -- Tabla de grupos (curso, seccion, etc.)
        CREATE TABLE groups (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) UNIQUE NOT NULL
        );

        -- Usuarios con rol
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'docente', 'alumno')),
          group_id INTEGER REFERENCES groups(id), -- Solo para alumnos
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Relacion DOCENTE -> MUCHOS GRUPOS
        CREATE TABLE teacher_groups (
          id SERIAL PRIMARY KEY,
          teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
          UNIQUE(teacher_id, group_id)
        );

        -- Tokens de sesion
        CREATE TABLE auth_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL,
          expires_at TIMESTAMP,
          revoked_at TIMESTAMP
        );

        -- Tareas asignadas
        CREATE TABLE tasks (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          assigned_to INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_by INTEGER NOT NULL REFERENCES users(id),
          group_id INTEGER REFERENCES groups(id),
          done BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Usuario admin por defecto
        INSERT INTO users (username, password_hash, role)
        VALUES ('admin@unas.com', crypt('Tevis123!', gen_salt('bf')), 'admin');

    EOT
  }
}

# Deployment de Postgres (task-db)
resource "kubernetes_deployment" "task_db" {
  provider = kubernetes.eks

  metadata {
    name      = "task-db"
    namespace = kubernetes_namespace.unas_tasks.metadata[0].name
    labels = {
      app = "task-db"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "task-db"
      }
    }

    template {
      metadata {
        labels = {
          app = "task-db"
        }
      }

      spec {
        container {
          name  = "task-db"
          image = "postgres:15"

          port {
            container_port = 5432
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db.metadata[0].name
                key  = "POSTGRES_USER"
              }
            }
          }

          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db.metadata[0].name
                key  = "POSTGRES_DB"
              }
            }
          }

          volume_mount {
            name       = "db-init"
            mount_path = "/docker-entrypoint-initdb.d/init.sql"
            sub_path   = "init.sql"
          }
        }

        volume {
          name = "db-init"

          config_map {
            name = kubernetes_config_map.db_init.metadata[0].name
          }
        }
      }
    }
  }
}

# Service de Postgres
resource "kubernetes_service" "task_db" {
  provider = kubernetes.eks

  metadata {
    name      = "task-db"
    namespace = kubernetes_namespace.unas_tasks.metadata[0].name
  }

  spec {
    selector = {
      app = "task-db"
    }

    port {
      port        = 5432
      target_port = 5432
    }

    type = "ClusterIP"
  }
}

# Deployment de Task-API (task-web)
resource "kubernetes_deployment" "task_web" {
  provider = kubernetes.eks

  metadata {
    name      = "task-web"
    namespace = kubernetes_namespace.unas_tasks.metadata[0].name
    labels = {
      app = "task-web"
    }
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "task-web"
      }
    }

    template {
      metadata {
        labels = {
          app = "task-web"
        }
      }

      spec {
        container {
          name  = "task-web"
          image = var.task_web_image

          port {
            container_port = 3200
          }

          # DB
          env {
            name  = "POSTGRES_HOST"
            value = kubernetes_service.task_db.metadata[0].name
          }

          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db.metadata[0].name
                key  = "POSTGRES_USER"
              }
            }
          }

          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db.metadata[0].name
                key  = "POSTGRES_PASSWORD"
              }
            }
          }

          env {
            name = "POSTGRES_DB"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db.metadata[0].name
                key  = "POSTGRES_DB"
              }
            }
          }

          env {
            name  = "POSTGRES_PORT"
            value = "5432"
          }

          # JWT
          env {
            name = "JWT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.jwt.metadata[0].name
                key  = "JWT_SECRET"
              }
            }
          }

          env {
            name = "JWT_EXPIRES_IN"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.jwt.metadata[0].name
                key  = "JWT_EXPIRES_IN"
              }
            }
          }

          env {
            name  = "PORT"
            value = "3200"
          }
        }
      }
    }
  }
}

# Service de Task-API (LoadBalancer)
resource "kubernetes_service" "task_web" {
  provider = kubernetes.eks

  metadata {
    name      = "task-web"
    namespace = kubernetes_namespace.unas_tasks.metadata[0].name
  }

  spec {
    selector = {
      app = "task-web"
    }

    port {
      port        = 80
      target_port = 3200
    }

    type = "LoadBalancer"
  }
}
