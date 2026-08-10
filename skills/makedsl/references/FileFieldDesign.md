# FileField

FileField 用于在业务记录中保存图片、PDF 等文件附件。

FileField 的公开值始终是附件数组，通过 `maxCount` 控制最多允许上传多少个文件。字段 DSL 说明见 @FieldDesign.md 。元数据消费方必须保留 `maxCount`，供下游按同一数量上限处理文件值。

公开读写结构如下，调用方不需要也不应该构造内部存储结构 `{"files":[...]}`：

```json
[
  {
    "fileName": "invoice1.pdf",
    "filePath": "${org}/${app}/${sha256}.pdf",
    "fileSizeInBytes": 2048000,
    "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256}.pdf"
  }
]
```

其中：

- `filePath` 是对象存储路径，不包含 `entityKey`
- `fileURL` 是下载地址，下载路径会包含 `entityKey`
- 当 `maxCount=1` 时，返回结构仍然是单元素数组，而不是对象

## File 字段的流程

FileField 支持两种上传模式。

### 模式一：仅上传并返回附件数组

适用于先上传文件，再把附件数组写入创建或更新 Record 的场景。

1. 创建 Entity 和 FileField
2. 调用文件上传接口，不传 `recordID`
3. 上传接口只返回 `fieldKey` 对应字段的附件数组，不读取、不更新业务记录
4. 调用创建或更新 Record 接口，把该附件数组写入 FileField

### 模式二：绑定已有 Record 上传

适用于 Record 已经存在，需要把文件直接追加到已有 FileField 的场景。

1. 创建 Entity 和 FileField
2. 创建 Record，得到 `recordID`
3. 调用文件上传接口，`meta.recordID` 必填
4. 上传成功后服务端会把附件数组合并写入该 Record 的 FileField，无需再调用 UpdateResource
5. 客户端可以根据 FileField 中的 `fileURL` 通过 GET 下载

### 文件元数据操作

- 获取文件信息：使用文件接口的 `MakeService.GetResource`，必须传 `recordID` 和 `fieldKey`
- 删除文件信息：使用文件接口的 `MakeService.DeleteResource`，必须传 `recordID`、`fieldKey` 和对象文件名末段 `fileName`
- 删除只清理业务记录中的文件元数据，不删除 TOS 对象

## 例子

### 业务场景

我需要提交一个发票报销，需要包含的内容是 `amount` 和 `invoice`。

### Step 1: 创建 Entity

需要创建一个 Reimbursement(报销) 的 Entity。

```yaml
key: reimbursement
name: 报销单
type: Make.Entity
appKey: <Make.App>
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

### Step 2A: 仅上传发票文件并返回附件数组

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
  "fieldKey": "invoice"
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
    "invoice": [
      {
        "fileName": "invoice1.pdf",
        "filePath": "${org}/${app}/${sha256_1}.pdf",
        "fileSizeInBytes": 2048000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_1}.pdf"
      },
      {
        "fileName": "invoice2.pdf",
        "filePath": "${org}/${app}/${sha256_2}.pdf",
        "fileSizeInBytes": 1024000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_2}.pdf"
      }
    ]
  }
}
```

未传 `recordID` 时，响应 `data` 不包含 `recordID`。返回的 `"invoice"` 数组就是 FileField 的公开写入结构。

### Step 2B: 使用附件数组创建 Record

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.CreateResource
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "reimbursement",
  "data": {
    "amount": 1280.50,
    "invoice": [
      {
        "fileName": "invoice1.pdf",
        "filePath": "${org}/${app}/${sha256_1}.pdf",
        "fileSizeInBytes": 2048000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_1}.pdf"
      },
      {
        "fileName": "invoice2.pdf",
        "filePath": "${org}/${app}/${sha256_2}.pdf",
        "fileSizeInBytes": 1024000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_2}.pdf"
      }
    ]
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

### Step 3A: 创建已有 Record

如果业务流程要求先创建 Record，再把文件绑定到已有记录，可以使用已有 Record 绑定上传模式。

注意：当前示例中的 `invoice` 配置了 `isRequired: true`，因此正式创建报销单时应优先使用 Step 2A/2B，把附件数组随创建 Record 一起提交。下面的先创建 Record 再绑定文件流程只适用于 FileField 非必填、草稿创建或其他允许暂缺附件的业务场景。

```
POST https://dev-make.qtech.cn/api/make/data/v1/record
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
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

### Step 3B: 根据 Record ID 上传并绑定发票文件

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
        "fileName": "invoice1.pdf",
        "filePath": "${org}/${app}/${sha256_1}.pdf",
        "fileSizeInBytes": 2048000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_1}.pdf"
      },
      {
        "fileName": "invoice2.pdf",
        "filePath": "${org}/${app}/${sha256_2}.pdf",
        "fileSizeInBytes": 1024000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_2}.pdf"
      }
    ]
  }
}
```

这里只返回 `recordID` 和 `fieldKey` 对应字段的信息。上传成功后，这个 Record 的 FileField 会自动更新为文件信息，无需再调用 UpdateResource。

### Step 4: 获取 Record 验证文件已关联

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
        "fileName": "invoice1.pdf",
        "filePath": "${org}/${app}/${sha256_1}.pdf",
        "fileSizeInBytes": 2048000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_1}.pdf"
      },
      {
        "fileName": "invoice2.pdf",
        "filePath": "${org}/${app}/${sha256_2}.pdf",
        "fileSizeInBytes": 1024000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_2}.pdf"
      }
    ]
  }
}
```

### Step 5: 获取文件信息

```
POST https://dev-make.qtech.cn/api/make/data/v1/file
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
  "recordID": "123",
  "fieldKey": "invoice"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "get file success",
  "data": {
    "recordID": "123",
    "invoice": [
      {
        "fileName": "invoice1.pdf",
        "filePath": "${org}/${app}/${sha256_1}.pdf",
        "fileSizeInBytes": 2048000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_1}.pdf"
      },
      {
        "fileName": "invoice2.pdf",
        "filePath": "${org}/${app}/${sha256_2}.pdf",
        "fileSizeInBytes": 1024000,
        "fileURL": "https://dev-make.qtech.cn/api/make/data/v1/download/${org}/${app}/${entityKey}/${sha256_2}.pdf"
      }
    ]
  }
}
```

### Step 6: 删除文件信息

```
POST https://dev-make.qtech.cn/api/make/data/v1/file
HEADER
  Authorization: Bearer <JWT Token>
  Content-Type: application/json
  X-Make-Target: MakeService.DeleteResource
```

Request Body

```json
{
  "appKey": "<APP_KEY>",
  "entityKey": "reimbursement",
  "recordID": "123",
  "fieldKey": "invoice",
  "fileName": "${sha256_1}.pdf"
}
```

Response Body

```json
{
  "code": 200,
  "msg": "delete file success",
  "data": {}
}
```

删除文件信息时，`fileName` 使用对象文件名末段，不传完整 `filePath`。服务端只清理业务记录中的文件元数据，不删除 TOS 对象。

### Step 7: 下载文件

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
