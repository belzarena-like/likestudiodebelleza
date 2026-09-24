docker buildx build     --platform linux/arm64     -f whatsapp-service/Dockerfile     -t crm-whatsapp-baileys:latest     --load     .


docker save crm-whatsapp-baileys:latest -o crm-whatsapp-baileys.tar


scp -i /c/users/JNBE/develop/personal/listo/oracle_listo_metrics.key   ~/develop/personal/crmLiliya/crm-whatsapp-baileys.tar    opc@163.192.124.131:/tmp/;


on server:
docker load -i /tmp/crm-whatsapp-baileys.tar

docker rm -f crm-whatsapp-baileys.tar 2>/dev/null || true
