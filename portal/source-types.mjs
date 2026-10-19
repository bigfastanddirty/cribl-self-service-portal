// Version 1: source types observed in the Cribl Stream 4.20.1 Sources UI.
// Summary choices only: availability does not authorize creating a source.
const rows = `syslog|Syslog|Receive system and application messages sent using Syslog.
tcpjson|TCP JSON|Receive structured JSON events over a TCP connection.
splunk|Splunk TCP|Receive events forwarded using the Splunk TCP protocol.
splunk_hec|Splunk HEC|Receive logs sent to a Splunk HTTP Event Collector endpoint.
firehose|Amazon Firehose|Receive data delivered by Amazon Data Firehose.
prometheus_rw|Prometheus Remote Write|Receive metrics sent using Prometheus remote write.
wiz_webhook|Wiz Webhook|Receive security notifications sent by Wiz.
grafana|Grafana|Receive telemetry sent by Grafana integrations.
loki|Loki|Receive logs sent using the Loki push protocol.
http|HTTP|Receive events sent by an application over HTTP.
http_raw|Raw HTTP|Receive HTTP request bodies as raw event data.
elastic|Elasticsearch API|Receive events sent using Elasticsearch-compatible ingestion requests.
metrics|Metrics|Receive metric data from supported metric clients.
snmp|SNMP Trap|Receive device alerts sent as SNMP traps.
tcp|TCP|Receive raw log data over TCP.
raw_udp|Raw UDP|Receive raw log messages over UDP.
netflow|NetFlow & IPFIX|Receive network traffic flow records from devices.
open_telemetry|OpenTelemetry|Receive logs metrics and traces from OpenTelemetry clients.
model_driven_telemetry|Model Driven Telemetry|Receive structured telemetry streamed by network devices.
datadog_agent|Datadog Agent|Receive telemetry sent by Datadog agents.
wef|Windows Event Forwarder|Receive Windows events through event forwarding.
zscaler_hec|Zscaler Cloud NSS|Receive security logs from Zscaler Cloud NSS.
cloudflare_hec|Cloudflare|Receive logs delivered by Cloudflare.
sysdig_hec|Sysdig Cloud NSS|Receive security events from Sysdig.
upwind_hec|Upwind|Receive security events from Upwind.
aqua_security_hec|Aqua Security|Receive security events from Aqua Security.
akamai_hec|Akamai HEC|Receive logs delivered by Akamai.
vectra_ai_hec|Vectra AI|Receive security events from Vectra AI.
sailpoint_hec|SailPoint|Receive identity events from SailPoint.
f5_big_ip|F5 BIG-IP|Receive logs from F5 BIG-IP devices.
extrahop_revealx_360|ExtraHop RevealX 360|Receive network security events from ExtraHop.
beyondtrust_hec|BeyondTrust|Receive security and access events from BeyondTrust.
hashicorp_hcp_vault_dedicated|HashiCorp HCP Vault Dedicated|Receive audit events from HCP Vault Dedicated.
mimecast_hec|Mimecast HEC|Receive email security events from Mimecast.
trend_micro_vision_one|Trend Micro Vision One|Receive security events from Trend Micro Vision One.
ping_identity_pingone|Ping Identity PingOne|Receive identity events from PingOne.
gigamon_hec|Gigamon|Receive telemetry delivered by Gigamon.
trellix_hec|Trellix|Receive security events from Trellix.
splunk_search|Splunk Search|Retrieve events by running searches against Splunk.
msk|Amazon MSK|Read events from Amazon Managed Streaming for Apache Kafka.
kinesis|Amazon Kinesis|Read events from Amazon Kinesis streams.
sqs|Amazon SQS|Read messages from Amazon SQS queues.
s3|Amazon S3|Retrieve log objects from Amazon S3 buckets.
bedrock_s3|Amazon Bedrock|Retrieve Bedrock logs stored in Amazon S3.
security_lake|Amazon Security Lake|Retrieve security data from Amazon Security Lake.
eventhub|Azure Event Hubs|Read events from Azure Event Hubs.
eventhub_amqp|Azure Event Hubs AMQP|Read Azure Event Hubs messages using AMQP.
azure_blob|Azure Blob Storage|Retrieve logs from Azure Blob Storage.
azure_vnet_flow_log|Azure VNet Flow Logs|Retrieve Azure virtual network flow logs.
google_pubsub|Google Cloud Pub/Sub|Read messages from Google Cloud Pub/Sub subscriptions.
office365_service|Microsoft 365 Services|Retrieve service logs from Microsoft 365.
office365_mgmt|Microsoft 365 Activity|Retrieve Microsoft 365 activity and audit events.
office365_msg_trace|Microsoft 365 Message Trace|Retrieve Microsoft 365 email message trace records.
microsoft_graph|Microsoft Graph|Retrieve data through Microsoft Graph.
microsoft_copilot|Microsoft Copilot|Retrieve Microsoft Copilot activity data.
prometheus|Prometheus Scraper|Collect metrics from Prometheus-compatible endpoints.
servicenow_table|ServiceNow Table API|Retrieve records through the ServiceNow Table API.
wiz|Wiz API|Retrieve security data through the Wiz API.
openai|OpenAI|Retrieve data from supported OpenAI services.
openai_compliance_logs|OpenAI Compliance Logs|Retrieve OpenAI compliance audit logs.
kafka|Kafka|Read events from Kafka topics.
confluent_cloud|Confluent Cloud|Read events from Confluent Cloud Kafka topics.
crowdstrike|CrowdStrike FDR|Retrieve Falcon Data Replicator security events.
anthropic_compliance|Claude Compliance|Retrieve Claude compliance audit events.
anthropic_enterprise_analytics|Claude Enterprise Analytics|Retrieve Claude enterprise usage analytics.
okta|Okta|Retrieve identity and access events from Okta.
appscope|AppScope|Receive application telemetry captured by AppScope.
datagen|Datagen|Generate synthetic events for testing.
exec|Exec|Collect output from an administrator-configured command.
file|File Monitor|Collect logs by monitoring files.
collector:azure_blob|Azure Blob Collector|Collect objects from Azure Blob Storage in a collection job.
collector:database|Database Collector|Retrieve records from a database in a collection job.
collector:filesystem|File System Collector|Collect files from a filesystem in a collection job.
collector:google_cloud_storage|Google Cloud Storage Collector|Collect objects from Google Cloud Storage.
collector:health_check|Health Check Collector|Check the availability of configured services.
collector:rest|REST Collector|Retrieve data from a REST endpoint in a collection job.
collector:s3|S3 Collector|Collect objects from Amazon S3 in a collection job.
collector:script|Script Collector|Collect output from an administrator-configured script.
collector:splunk|Splunk Search Collector|Retrieve Splunk search results in a collection job.`;
export const SOURCE_TYPES = rows.split('\n').map(row => { const [type,label,description] = row.split('|'); return {type,label,description}; });
export function sourceTypeChoices(configured, targets = {}) {
  const lookup = new Map(SOURCE_TYPES.map(s=>[s.type,s]));
  const choices = configured.map(s=>({key:s.key,label:s.label,description:lookup.get(s.type)?.description || 'Collect events using this configured source. Connection details require administrator review.',disabled:s.disabled,provisioning:s.type==='splunk_hec' && !s.disabled && targets.source===s.key ? 'hec':'summary'}));
  for (const source of SOURCE_TYPES) if (!configured.some(s=>s.type===source.type)) choices.push({key:'type:'+source.type,label:source.label,description:source.description+' This type is not configured here; submission records your request only.',disabled:false,provisioning:'summary'});
  return choices.sort((a,b)=>a.label.localeCompare(b.label));
}
