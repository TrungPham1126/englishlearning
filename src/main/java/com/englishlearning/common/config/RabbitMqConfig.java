package com.englishlearning.common.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {

    public static final String VIDEO_EXCHANGE = "video.exchange";
    public static final String VIDEO_TRANSCODE_QUEUE = "video.transcode.queue";
    public static final String VIDEO_TRANSCODE_ROUTING_KEY = "video.transcode";

    public static final String NOTIFICATION_EXCHANGE = "notification.exchange";
    public static final String NOTIFICATION_QUEUE = "notification.queue";
    public static final String NOTIFICATION_ROUTING_KEY = "notification.send";

    @Bean
    public DirectExchange videoExchange() {
        return new DirectExchange(VIDEO_EXCHANGE);
    }

    @Bean
    public Queue videoTranscodeQueue() {
        return QueueBuilder.durable(VIDEO_TRANSCODE_QUEUE).build();
    }

    @Bean
    public Binding videoTranscodeBinding(Queue videoTranscodeQueue, DirectExchange videoExchange) {
        return BindingBuilder.bind(videoTranscodeQueue).to(videoExchange).with(VIDEO_TRANSCODE_ROUTING_KEY);
    }

    @Bean
    public DirectExchange notificationExchange() {
        return new DirectExchange(NOTIFICATION_EXCHANGE);
    }

    @Bean
    public Queue notificationQueue() {
        return QueueBuilder.durable(NOTIFICATION_QUEUE).build();
    }

    @Bean
    public Binding notificationBinding(Queue notificationQueue, DirectExchange notificationExchange) {
        return BindingBuilder.bind(notificationQueue).to(notificationExchange).with(NOTIFICATION_ROUTING_KEY);
    }

    @Bean
    public MessageConverter jsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public AmqpTemplate amqpTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(jsonMessageConverter());
        return template;
    }
}