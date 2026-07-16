# FileField
我们目前 FileField 在业务上是用于业务可以上传图片/PDF 等各种文件

FileField 的值始终是数组，通过 `properties.maxCount` 控制最多允许上传多少个文件。字段 DSL 说明见 @FieldDesign.md。元数据消费方必须保留 `maxCount`，供下游按同一数量上限处理文件值。

## File 字段的流程
1. 先创建 Entity -> FileField
2. 创建一个 Record, 然后会得到 Record id
3. 根据 Record id 上传文件
4. 上传成功会返回文件的地址, 也会同时自动更新 FileField 中的地址
5. 客户端可以根据 FileField 中的 fileURL 通过 GET 直接下载

## 例子
### 业务场景
我需要提交一个发票报销, 需要包含的内容 `amount`, `invoice`
#### Step 1: 创建 Entity
需要创建一个 Reimbursement(报销) 的 Entity
```yaml
key: reimbursement
name: 报销单
type: Make.Entity
app: <Make.App>
meta:
  version: 1.0.0
properties:
  fields:
    - key: amount
      name: 报销金额
      type: Make.Field.Currency
      meta:
        version: 1.0.0
      properties:
        symbol: "¥"
        decimalPlaces: 2
        useGrouping: true
      validations:
        isRequired: true

    - key: invoice
      name: 发票
      type: Make.Field.File
      meta:
        version: 1.0.0
      properties:
        maxCount: 2
      validations:
        isRequired: true
        mustBePDF: true
```
然后我会提交一个 Record
#### Step 2: 创建 Record

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  X-Make-Target: MakeService.CreateResource
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "reimbursement",
  "data": {
    "amount": 1280.50
  }
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Create record success",
  "data": {
    "recordID": "123"
  }
}
```

#### Step 3: 根据 Record ID 上传发票文件

```
POST https://dev-make.qtech.cn/api/make/data/v1/file
HEADER
  Authorization: Bearer <JWT Token>
  X-Make-Target: MakeService.CreateResource
  Content-Type: multipart/form-data
```

Request Body (multipart/form-data)

```
--boundary
Content-Disposition: form-data; name="meta"
Content-Type: application/json

{
  "appKey": "<APP_KEY>",
  "entityKey": "reimbursement",
  "fieldKey": "invoice",
  "recordID": "123"
}
--boundary
Content-Disposition: form-data; name="file"; filename="invoice1.pdf"
Content-Type: application/pdf
<binary>
--boundary
Content-Disposition: form-data; name="file"; filename="invoice2.pdf"
Content-Type: application/pdf
<binary>
--boundary--
```

Response Body

```json
{
  "code": 200,
  "msg": "upload file success",
  "data": {
    "recordID": "123",
    "invoice": [
      {
        "fileName": "realName1.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 2048000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      },
      {
        "fileName": "realName2.png",
        "filePath": "${org}/${app}/${sha256}.png",
        "fileSizeInBytes": 1024000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      }
    ]
  }
}
```
这里只返回 recordID 和 对应的 field 的信息

> 上传成功后, 这个 Record 的 FileField 的值会自动更新为文件信息, 无需再调用 UpdateResource
也就是说这时候如果去获取这个 Record 的记录，发票字段已自动填充, 如下所示

#### Step 4: 获取 Record 验证文件已关联

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.GetResource
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "reimbursement",
  "recordID": "123"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "Get record success",
  "data": {
    "recordID": "123",
    "amount": 1280.50,
    "invoice": [
      {
        "fileName": "taxi.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 2048000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      },
      {
        "fileName": "train.pdf",
        "filePath": "${org}/${app}/${sha256}.pdf",
        "fileSizeInBytes": 1024000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${filePath}"
      }
    ]
  }
}
```

当 `maxCount=1` 时，返回结构仍然是单元素数组，而不是对象。

#### Step 5: 下载文件
GET `fileURL`，服务端校验权限后从云存储流式返回文件内容。

```
GET ${fileURL}
HEADER
  Authorization: Bearer <JWT Token>
```

Response Header

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="${fileName}"
```

Response Body

```
<binary>
```
