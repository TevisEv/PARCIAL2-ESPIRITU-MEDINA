terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.30"
    }
  }
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

# Namespace
resource "kubernetes_namespace" "unas_tasks" {
  metadata {
    name = var.namespace
  }
}

# Secret de DB
resource "kubernetes_secret" "db" {
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
  metadata {
    name      = "jwt-secret"
    namespace = kubernetes_namespace.unas_tasks.metadata[0].name
  }

  data = {
    JWT_SECRET      = base64encode(var.jwt_secret)
    JWT_EXPIRES_IN  = base64encode(var.jwt_expires_in)
  }

  type = "Opaque"
}

# Deployment de Postgres (task-db)
resource "kubernetes_deployment" "task_db" {
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
        }
      }
    }
  }
}

# Service de Postgres
resource "kubernetes_service" "task_db" {
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

# Service de Task-API
resource "kubernetes_service" "task_web" {
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
