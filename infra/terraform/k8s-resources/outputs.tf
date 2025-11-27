output "task_web_service_name" {
  value = kubernetes_service.task_web.metadata[0].name
}

output "task_web_service_type" {
  value = kubernetes_service.task_web.spec[0].type
}
