"use client";

import { PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { Button, Col, Form, Input, InputNumber, Row, Select, Space, Typography } from "antd";

const kindOptions = [
  { value: "chat_text", label: "Chat text" },
  { value: "image_generation", label: "Image generation" },
];

function Rate({ name, label }: { name: (string | number)[]; label: string }) {
  return (
    <Form.Item name={name} label={label} rules={[{ required: true, message: "Required" }]}>
      <InputNumber min={0} step={0.01} className="w-full" />
    </Form.Item>
  );
}

export function OpenAIPricingEditor({ name }: { name: string }) {
  return (
    <Form.List name={name}>
      {(fields, { add, remove }) => (
        <Space orientation="vertical" size="middle" className="w-full">
          {fields.map((field) => (
            <div key={field.key}>
              <Row gutter={[16, 0]} align="top">
                <Col xs={24} lg={7}>
                  <Form.Item
                    name={[field.name, "model"]}
                    label="Model"
                    rules={[{ required: true, message: "Required" }]}
                  >
                    <Input placeholder="gpt-5-mini" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={6}>
                  <Form.Item
                    name={[field.name, "kind"]}
                    label="Kind"
                    rules={[{ required: true, message: "Required" }]}
                  >
                    <Select options={kindOptions} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={10}>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, next) =>
                      prev[name]?.[field.name]?.kind !== next[name]?.[field.name]?.kind
                    }
                  >
                    {({ getFieldValue }) => {
                      const kind = getFieldValue([name, field.name, "kind"]);
                      return kind === "image_generation" ? (
                        <Row gutter={[8, 0]}>
                          <Col span={8}>
                            <Rate name={[field.name, "textInput"]} label="Text input" />
                          </Col>
                          <Col span={8}>
                            <Rate name={[field.name, "imageInput"]} label="Image input" />
                          </Col>
                          <Col span={8}>
                            <Rate name={[field.name, "imageOutput"]} label="Image output" />
                          </Col>
                        </Row>
                      ) : (
                        <Row gutter={[8, 0]}>
                          <Col span={8}>
                            <Rate name={[field.name, "input"]} label="Input" />
                          </Col>
                          <Col span={8}>
                            <Rate name={[field.name, "cachedInput"]} label="Cached input" />
                          </Col>
                          <Col span={8}>
                            <Rate name={[field.name, "output"]} label="Output" />
                          </Col>
                        </Row>
                      );
                    }}
                  </Form.Item>
                </Col>
                <Col xs={24} lg={1}>
                  <Button
                    type="text"
                    danger
                    icon={<TrashIcon size={18} />}
                    aria-label="Remove pricing row"
                    onClick={() => remove(field.name)}
                  />
                </Col>
              </Row>
            </div>
          ))}
          {fields.length === 0 ? (
            <Typography.Text type="secondary">No per-model pricing configured yet.</Typography.Text>
          ) : null}
          <Button icon={<PlusIcon size={16} />} onClick={() => add({ kind: "chat_text" })}>
            Add model pricing
          </Button>
        </Space>
      )}
    </Form.List>
  );
}
