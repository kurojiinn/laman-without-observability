package storage

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinIOProvider struct {
	client    *minio.Client
	bucket    string
	publicURL string
}

func NewMinIOProvider(endpoint, publicURL, accessKey, secretKey, bucket string, useSSL bool) (*MinIOProvider, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("minio init: %w", err)
	}

	return &MinIOProvider{
		client:    client,
		bucket:    bucket,
		publicURL: strings.TrimRight(publicURL, "/"),
	}, nil
}

func (p *MinIOProvider) Upload(ctx context.Context, key, contentType string, data []byte) (string, error) {
	_, err := p.client.PutObject(ctx, p.bucket, key, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("minio upload %s: %w", key, err)
	}

	return fmt.Sprintf("%s/%s/%s", p.publicURL, p.bucket, key), nil
}
