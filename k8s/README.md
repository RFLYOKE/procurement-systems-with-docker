# Kubernetes Deployment Guide

Panduan ini berisi langkah-langkah untuk mendeploy API Procurement System ke dalam Kubernetes (K8s).

## Prasyarat
- Anda memiliki cluster Kubernetes yang berjalan (bisa menggunakan **Docker Desktop Kubernetes**, **Minikube**, atau layanan cloud seperti **GKE / EKS / AKS**).
- Command line `kubectl` sudah terinstall dan terkoneksi ke cluster Anda.
- Jika menggunakan local K8s, pastikan Anda mem-build image Docker di environment K8s Anda, atau push image Anda ke Docker Hub.

## Langkah-langkah Deployment

1. **Build Docker Image (Lokal)**
   Jika Anda menggunakan Docker Desktop K8s, Anda bisa membuild image agar tersedia secara lokal.
   ```bash
   docker build -t procurement-system-app:latest .
   ```

2. **Deploy MySQL**
   Pertama, deploy database MySQL. File `mysql-deployment.yaml` berisi kredensial (Secret), volume (PVC), deployment, dan service.
   ```bash
   kubectl apply -f k8s/mysql-deployment.yaml
   ```

3. **Deploy Redis**
   Selanjutnya, deploy instance Redis.
   ```bash
   kubectl apply -f k8s/redis-deployment.yaml
   ```

4. **Verifikasi Database dan Redis**
   Pastikan pods untuk MySQL dan Redis sudah berstatus `Running`.
   ```bash
   kubectl get pods
   ```
   *Catatan: Anda mungkin perlu meng-eksekusi file inisialisasi `database.sql` ke dalam pod MySQL secara manual jika Anda baru pertama kali membuatnya di K8s:*
   ```bash
   kubectl exec -i <mysql-pod-name> -- mysql -uroot -ppassword123 procurement_db < docker/init.sql
   ```

5. **Deploy Aplikasi Node.js**
   Terakhir, deploy aplikasi Anda beserta ConfigMap-nya.
   ```bash
   kubectl apply -f k8s/app-deployment.yaml
   ```

6. **Cek Status Semua Komponen**
   ```bash
   kubectl get all
   ```

## Mengakses API

Aplikasi (App Service) diset ke tipe `NodePort` pada port `30000`.
- Jika Anda menggunakan **Docker Desktop K8s**, Anda bisa mengakses API di: `http://localhost:30000`
- Jika Anda menggunakan **Minikube**, dapatkan URL-nya dengan perintah:
  ```bash
  minikube service app-service --url
  ```

## Menghapus (Clean-up) Resource
Untuk menghapus seluruh infrastruktur yang sudah dideploy:
```bash
kubectl delete -f k8s/app-deployment.yaml
kubectl delete -f k8s/redis-deployment.yaml
kubectl delete -f k8s/mysql-deployment.yaml
```
