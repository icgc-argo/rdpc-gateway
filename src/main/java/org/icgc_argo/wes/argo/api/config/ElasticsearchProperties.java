package org.icgc_argo.wes.argo.api.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "elastic")
public class ElasticsearchProperties {
  String host;
  Integer port;
  String maestroIndex;
}
