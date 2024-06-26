/**
 * NOTE: this code file was automatically migrated to TypeScript using ts-migrate and
 * may contain multiple `any` type annotations and `@ts-expect-error` directives.
 * If possible, please improve types while making changes to this file. If the type
 * annotations are already looking good, please remove this comment.
 */

import React from 'react';
import { Typography } from '@databricks/design-system';
import { mountWithIntl, shallowWithIntl } from '../../common/utils/TestUtils';
import { ArtifactView, ArtifactViewImpl } from './ArtifactView';
import ShowArtifactTextView from './artifact-view-components/ShowArtifactTextView';
import ShowArtifactImageView from './artifact-view-components/ShowArtifactImageView';
import { LazyShowArtifactMapView } from './artifact-view-components/LazyShowArtifactMapView';
import ShowArtifactHtmlView from './artifact-view-components/ShowArtifactHtmlView';
import { ArtifactNode } from '../utils/ArtifactUtils';
import { mockModelVersionDetailed } from '../../model-registry/test-utils';
import { ModelVersionStatus, Stages } from '../../model-registry/constants';
import { Provider } from 'react-redux';
import { BrowserRouter } from '../../common/utils/RoutingUtils';
import configureStore from 'redux-mock-store';
import promiseMiddleware from 'redux-promise-middleware';
import thunk from 'redux-thunk';
import Utils from '../../common/utils/Utils';

const { Text } = Typography;

// Mock these methods because js-dom doesn't implement window.Request
jest.mock('../../common/utils/ArtifactUtils', () => ({
  ...jest.requireActual('../../common/utils/ArtifactUtils'),
  // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
  getArtifactContent: jest.fn().mockResolvedValue(),
  // @ts-expect-error TS(2554): Expected 1 arguments, but got 0.
  getArtifactBytesContent: jest.fn().mockResolvedValue(),
}));

describe('ArtifactView', () => {
  let wrapper;
  let minimalProps: any;
  let minimalStore: any;
  let minimalEntities: any;
  const mockStore = configureStore([thunk, promiseMiddleware()]);
  const getMockStore = (rootNode: any) => {
    return mockStore({
      entities: {
        ...minimalEntities,
        artifactsByRunUuid: { fakeUuid: rootNode },
      },
    });
  };
  const getWrapper = (fakeStore: any, mockProps: any) =>
    mountWithIntl(
      <Provider store={fakeStore}>
        <BrowserRouter>
          <ArtifactView {...mockProps} />
        </BrowserRouter>
      </Provider>,
    );
  beforeEach(() => {
    // TODO: remove global fetch mock by explicitly mocking all the service API calls
    // @ts-expect-error TS(2322): Type 'Mock<Promise<{ ok: true; status: number; tex... Remove this comment to see the full error message
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('') }));
    const node = getTestArtifactNode();
    minimalProps = {
      runUuid: 'fakeUuid',
      artifactNode: node,
      artifactRootUri: 'test_root',
      listArtifactsApi: jest.fn(() => Promise.resolve({})),
      modelVersionsBySource: {},
      handleActiveNodeChange: jest.fn(),
    };
    minimalEntities = {
      modelByName: {},
      artifactsByRunUuid: { fakeUuid: node },
      artifactRootUriByRunUuid: { fakeUuid: 'test_root' },
      modelVersionsByModel: {},
    };
    minimalStore = mockStore({
      entities: minimalEntities,
    });
  });
  const getTestArtifactNode = () => {
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const rootNode = new ArtifactNode(true, undefined);
    rootNode.isLoaded = true;
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const file1 = new ArtifactNode(false, { path: 'file1', is_dir: false, file_size: '159' });
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const dir1 = new ArtifactNode(false, { path: 'dir1', is_dir: true });
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const dir2 = new ArtifactNode(false, { path: 'dir2', is_dir: true });
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const file2 = new ArtifactNode(false, { path: 'dir1/file2', is_dir: false, file_size: '67' });
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const file3 = new ArtifactNode(false, { path: 'dir1/file3', is_dir: false, file_size: '123' });
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const file4 = new ArtifactNode(false, { path: 'dir2/file4', is_dir: false, file_size: '67' });
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const file5 = new ArtifactNode(false, { path: 'dir2/MLmodel', is_dir: false, file_size: '67' });
    dir1.setChildren([file2.fileInfo, file3.fileInfo]);
    dir2.setChildren([file4.fileInfo, file5.fileInfo]);
    rootNode.children = { file1, dir1, dir2 };
    return rootNode;
  };
  test('should render with minimal props without exploding', () => {
    wrapper = shallowWithIntl(<ArtifactViewImpl {...minimalProps} />);
    expect(wrapper.length).toBe(1);
  });
  test('should render NoArtifactView when no artifacts are present', () => {
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const emptyNode = new ArtifactNode(true, undefined);
    const props = { ...minimalProps, artifactNode: emptyNode };
    wrapper = getWrapper(getMockStore(emptyNode), props);
    expect(wrapper.find('.no-artifacts')).toHaveLength(1);
  });
  test('should render selected file artifact', () => {
    const props = { ...minimalProps };
    wrapper = getWrapper(minimalStore, props);
    const file1Element = wrapper.find('NodeHeader').at(0);
    file1Element.simulate('click');
    expect(wrapper.find('.artifact-info-path').html()).toContain('test_root/file1');
    expect(
      wrapper.containsMatchingElement(
        // @ts-expect-error TS(2322): Type '{ children: string; ellipsis: true; copyable... Remove this comment to see the full error message
        <Text ellipsis copyable>
          test_root/file1
        </Text>,
      ),
    ).toEqual(true);
    expect(wrapper.find('.artifact-info-size').html()).toContain('159B');
    // Selecting a file artifact should display a download link
    expect(wrapper.find('.artifact-info-link')).toHaveLength(1);
  });
  test('should render text file in text artifact view', () => {
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const rootNode = new ArtifactNode(true, undefined);
    rootNode.isLoaded = true;
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const textFile = new ArtifactNode(false, {
      path: 'file1.txt',
      is_dir: false,
      file_size: '159',
    });
    rootNode.setChildren([textFile.fileInfo]);
    wrapper = getWrapper(getMockStore(rootNode), minimalProps);
    const textFileElement = wrapper.find('NodeHeader').at(0);
    textFileElement.simulate('click');
    expect(wrapper.find(ShowArtifactTextView)).toHaveLength(1);
  });
  test('should render image file in image artifact view', () => {
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const rootNode = new ArtifactNode(true, undefined);
    rootNode.isLoaded = true;
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const imageFile = new ArtifactNode(false, {
      path: 'file1.png',
      is_dir: false,
      file_size: '159',
    });
    rootNode.setChildren([imageFile.fileInfo]);
    wrapper = getWrapper(getMockStore(rootNode), minimalProps);
    const imageFileElement = wrapper.find('NodeHeader').at(0);
    imageFileElement.simulate('click');
    expect(wrapper.find(ShowArtifactImageView)).toHaveLength(1);
  });
  test('should render HTML file in HTML artifact view', () => {
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const rootNode = new ArtifactNode(true, undefined);
    rootNode.isLoaded = true;
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const htmlFile = new ArtifactNode(false, {
      path: 'file1.html',
      is_dir: false,
      file_size: '159',
    });
    rootNode.setChildren([htmlFile.fileInfo]);
    wrapper = getWrapper(getMockStore(rootNode), minimalProps);
    const htmlFileElement = wrapper.find('NodeHeader').at(0);
    htmlFileElement.simulate('click');
    expect(wrapper.find(ShowArtifactHtmlView)).toHaveLength(1);
  });
  test('should render geojson file in map artifact view', () => {
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const rootNode = new ArtifactNode(true, undefined);
    rootNode.isLoaded = true;
    // @ts-expect-error TS(2554): Expected 3 arguments, but got 2.
    const geojsonFile = new ArtifactNode(false, {
      path: 'file1.geojson',
      is_dir: false,
      file_size: '159',
    });
    rootNode.setChildren([geojsonFile.fileInfo]);
    wrapper = getWrapper(getMockStore(rootNode), minimalProps);
    const geojsonFileElement = wrapper.find('NodeHeader').at(0);
    geojsonFileElement.simulate('click');
    expect(wrapper.find(LazyShowArtifactMapView)).toHaveLength(1);
  });
  test('should render selected directory artifact', () => {
    const props = { ...minimalProps };
    wrapper = getWrapper(minimalStore, props);
    const dir1Element = wrapper.find('NodeHeader').at(1);
    dir1Element.simulate('click');
    expect(wrapper.find('.artifact-info-path').html()).toContain('test_root/dir1');
    // Now that `dir1` has been selected, we expect the visible artifact tree
    // to contain 5 elements: file1, dir2, dir1, file2, and file3
    expect(wrapper.find('NodeHeader')).toHaveLength(5);
    // Size info should not be displayed
    expect(wrapper.find('.artifact-info-size')).toHaveLength(0);
  });
  test('should not render register model button for directory with no MLmodel file', () => {
    expect(Utils.isModelRegistryEnabled()).toEqual(true);
    const props = { ...minimalProps };
    wrapper = getWrapper(minimalStore, props);
    const dir1Element = wrapper.find('NodeHeader').at(1);
    dir1Element.simulate('click');
    expect(wrapper.find('.artifact-info-path').html()).toContain('test_root/dir1');
    expect(wrapper.find('.register-model-btn-wrapper')).toHaveLength(0);
  });
  test('should render register model button for directory with MLmodel file', () => {
    expect(Utils.isModelRegistryEnabled()).toEqual(true);
    const props = { ...minimalProps };
    wrapper = getWrapper(minimalStore, props);
    const dir2Element = wrapper.find('NodeHeader').at(2);
    dir2Element.simulate('click');
    expect(wrapper.find('.artifact-info-path').html()).toContain('test_root/dir2');
    expect(wrapper.find('.register-model-btn-wrapper')).toHaveLength(1);
  });
  test('should not render register model button for directory when registry is disabled', () => {
    const enabledSpy = jest.spyOn(Utils, 'isModelRegistryEnabled').mockImplementation(() => false);
    expect(Utils.isModelRegistryEnabled()).toEqual(false);
    const props = { ...minimalProps };
    wrapper = getWrapper(minimalStore, props);
    const dir1Element = wrapper.find('NodeHeader').at(1);
    dir1Element.simulate('click');
    expect(wrapper.find('.artifact-info-path').html()).toContain('test_root/dir1');
    expect(wrapper.find('.register-model-btn-wrapper')).toHaveLength(0);
    enabledSpy.mockRestore();
  });
  test('should render model version link for directory when version is present', () => {
    expect(Utils.isModelRegistryEnabled()).toEqual(true);
    const modelVersionsBySource = {
      'test_root/dir2': [mockModelVersionDetailed('Model A', 1, Stages.PRODUCTION, ModelVersionStatus.READY)],
    };
    const props = { ...minimalProps, modelVersionsBySource };
    const entities = {
      ...minimalEntities,
      modelVersionsByModel: {
        'Model A': {
          1: {
            ...mockModelVersionDetailed('Model A', 1, Stages.PRODUCTION, ModelVersionStatus.READY),
            source: 'test_root/dir2',
          },
        },
      },
    };
    const store = mockStore({
      entities: entities,
    });
    wrapper = getWrapper(store, props);
    const dir2Element = wrapper.find('NodeHeader').at(2);
    dir2Element.simulate('click');
    expect(wrapper.find('.artifact-info-path').html()).toContain('test_root/dir2');
    expect(wrapper.find('.model-version-info')).toHaveLength(1);
    expect(wrapper.find('.model-version-link')).toHaveLength(1);
    expect(wrapper.find('.model-version-link').html()).toContain('Model A');
    expect(wrapper.find('.model-version-link').html()).toContain('v1');
  });
  /**
   * A model version's source may be semantically equivalent to a run artifact path
   * but syntactically distinct; this occurs when there are redundant or trailing
   * slashes present in the version source or run artifact path. This test verifies that,
   * in these cases, model version information is still displayed correctly for a run artifact.
   */
  test('should render model version link for semantically equivalent artifact paths', () => {
    expect(Utils.isModelRegistryEnabled()).toEqual(true);
    // Construct a model version source that is semantically equivalent to a run artifact path
    // but syntactically different because it contains extra slashes. We expect that the UI
    // should still render the version source for this artifact
    const modelVersionSource = 'test_root////dir2///';
    const modelVersionsBySource = {
      modelVersionSource: [mockModelVersionDetailed('Model A', 1, Stages.PRODUCTION, ModelVersionStatus.READY)],
    };
    const props = { ...minimalProps, modelVersionsBySource };
    const entities = {
      ...minimalEntities,
      modelVersionsByModel: {
        'Model A': {
          1: {
            ...mockModelVersionDetailed('Model A', 1, Stages.PRODUCTION, ModelVersionStatus.READY),
            source: modelVersionSource,
          },
        },
      },
    };
    const store = mockStore({
      entities: entities,
    });
    wrapper = getWrapper(store, props);
    const dir2Element = wrapper.find('NodeHeader').at(2);
    dir2Element.simulate('click');
    expect(wrapper.find('.artifact-info-path').html()).toContain('test_root/dir2');
    expect(wrapper.find('.model-version-info')).toHaveLength(1);
    expect(wrapper.find('.model-version-link')).toHaveLength(1);
    expect(wrapper.find('.model-version-link').html()).toContain('Model A');
    expect(wrapper.find('.model-version-link').html()).toContain('v1');
  });
  test('should not render model version link for file under valid model version directory', () => {
    expect(Utils.isModelRegistryEnabled()).toEqual(true);
    const modelVersionsBySource = {
      'test_root/dir2': [mockModelVersionDetailed('Model A', 1, Stages.PRODUCTION, ModelVersionStatus.READY)],
    };
    const props = { ...minimalProps, modelVersionsBySource };
    const entities = {
      ...minimalEntities,
      modelVersionsByModel: {
        'Model A': {
          1: {
            ...mockModelVersionDetailed('Model A', 1, Stages.PRODUCTION, ModelVersionStatus.READY),
            source: 'test_root/dir2',
          },
        },
      },
    };
    const store = mockStore({
      entities: entities,
    });
    wrapper = getWrapper(store, props);
    const dir2Element = wrapper.find('NodeHeader').at(2);
    dir2Element.simulate('click');
    const file4Element = wrapper.find('NodeHeader').at(3);
    file4Element.simulate('click');
    expect(wrapper.find('.model-version-info')).toHaveLength(0);
    expect(wrapper.find('.model-version-link')).toHaveLength(0);
    expect(wrapper.find('.artifact-info-link')).toHaveLength(1);
  });
});
