package org.mlflow.spark.autologging

import java.io.File
import java.nio.file.{Files, Path, Paths}
import java.util.UUID

import org.apache.spark.mlflow.MlflowSparkAutologgingTestUtils
import org.apache.spark.sql.execution.ui.SparkListenerSQLExecutionEnd
import org.apache.spark.sql.{Row, SparkSession}
import org.apache.spark.sql.types.{IntegerType, StringType, StructField, StructType}
import org.mockito.Matchers.any
import org.mockito.Mockito._
import org.scalatest.{BeforeAndAfterAll, BeforeAndAfterEach}
import org.scalatest.FunSuite
import org.scalatest.Matchers

import scala.collection.mutable.ArrayBuffer

private[autologging] class MockSubscriber extends MlflowAutologEventSubscriber {
  private val uuid: String = UUID.randomUUID().toString
  override def replId: String = {
    uuid
  }

  override def notify(path: String, version: String, format: String): Unit = {
  }

  override def ping(): Unit = {}
}

private[autologging] class BrokenSubscriber extends MockSubscriber {
  override def ping(): Unit = {
    throw new RuntimeException("Oh no, failing ping!")
  }

  override def notify(path: String, version: String, format: String): Unit = {
    throw new RuntimeException("Unable to notify subscriber!")
  }

}

class SparkAutologgingSuite extends FunSuite with Matchers with BeforeAndAfterAll
  with BeforeAndAfterEach {

  var spark: SparkSession = getOrCreateSparkSession()

  var tempDir: Path  = _
  var formatToTablePath: Map[String, String] = _
  var deltaTablePath: String = _

  private def getOrCreateSparkSession(): SparkSession = {
    SparkSession
      .builder()
      .appName("MLflow Spark Autologging Tests")
      .config("spark.master", "local")
      .getOrCreate()
  }

  override def beforeAll(): Unit = {
    super.beforeAll()
    // Generate dummy data & write it in various formats (CSV, JSON, parquet)
    val rows = Seq(
      Row(8, "bat"),
      Row(64, "mouse"),
      Row(-27, "horse")
    )
    val schema = List(
      StructField("number", IntegerType),
      StructField("word", StringType)
    )
    val df = spark.createDataFrame(
      spark.sparkContext.parallelize(rows),
      StructType(schema)
    )
    tempDir = Files.createTempDirectory(this.getClass.getName)
    deltaTablePath = Paths.get(tempDir.toString, "delta").toString
    formatToTablePath = Seq( "csv", "parquet", "json" /*, delta */).map { format =>
      format -> Paths.get(tempDir.toString, format).toString
    }.toMap

    formatToTablePath.foreach { case (format, tablePath) =>
      df.write.option("header", "true").format(format).save(tablePath)
    }
  }

  override def afterAll(): Unit = {
    super.afterAll()
    def deleteRecursively(file: File): Unit = {
      if (file.isDirectory) {
        file.listFiles.foreach(deleteRecursively)
      }
      if (file.exists && !file.delete) {
        throw new RuntimeException(s"Unable to delete ${file.getAbsolutePath}")
      }
    }
    deleteRecursively(tempDir.toFile)
  }

  override def beforeEach(): Unit = {
    super.beforeEach()
    MlflowAutologEventPublisher.init()
  }

  override def afterEach(): Unit = {
    MlflowAutologEventPublisher.stop()
    super.afterEach()
  }

  private def getFileUri(absolutePath: String): String = {
    s"${Paths.get("file:", absolutePath).toString}"
  }

  test("MlflowAutologEventPublisher can be idempotently initialized & stopped within " +
    "single thread") {
    // We expect a listener to already be created by calling init() in beforeEach
    val listeners0 = MlflowSparkAutologgingTestUtils.getListeners(spark)
    assert(listeners0.length == 1)
    val listener0 = listeners0.head
    // Call init() again, verify listener is unchanged
    MlflowAutologEventPublisher.init()
    val listeners1 = MlflowSparkAutologgingTestUtils.getListeners(spark)
    assert(listeners1.length == 1)
    val listener1 = listeners1.head
    assert(listener0 == listener1)
    // Call stop() multiple times
    MlflowAutologEventPublisher.stop()
    assert(MlflowSparkAutologgingTestUtils.getListeners(spark).isEmpty)
    MlflowAutologEventPublisher.stop()
    assert(MlflowSparkAutologgingTestUtils.getListeners(spark).isEmpty)
    // Call init() after stop(), verify that we create a new listener
    MlflowAutologEventPublisher.init()
    val listeners2 = MlflowSparkAutologgingTestUtils.getListeners(spark)
    assert(listeners2.length == 1)
    val listener2 = listeners2.head
    assert(listener2 != listener1)
  }

  test("MlflowAutologEventPublisher triggers publishEvent with appropriate arguments " +
    "when reading datasources corresponding to different formats") {
      val formatToTestDFs = formatToTablePath.map { case (format, tablePath) =>
        val baseDf = spark.read.format(format).option("inferSchema", "true")
          .option("header", "true").load(tablePath)
        format -> Seq(
          baseDf,
          baseDf.filter("number > 0"),
          baseDf.select("number"),
          baseDf.limit(2),
          baseDf.filter("number > 0").select("number").limit(2)
        )
      }

        formatToTestDFs.foreach { case (format, dfs) =>
          dfs.foreach { df =>
            df.printSchema()
            MlflowAutologEventPublisher.init()
            val subscriber = spy(new MockSubscriber())
            MlflowAutologEventPublisher.register(subscriber)
            assert(MlflowAutologEventPublisher.subscribers.size == 1)
            // Read DF
            df.collect()
            // Verify events logged
            Thread.sleep(1000)
            val tablePath = formatToTablePath(format)
            val expectedPath = getFileUri(tablePath)
            verify(subscriber, times(1)).notify(any(), any(), any())
            verify(subscriber, times(1)).notify(expectedPath, "unknown", format)
            MlflowAutologEventPublisher.stop()
          }
        }
  }

  test("MlflowAutologEventPublisher triggers publishEvent with appropriate arguments " +
    "when reading a JOIN of two tables") {
    val formats = formatToTablePath.keys
    val leftFormat = formats.head
    val rightFormat = formats.last
    val leftPath = formatToTablePath(leftFormat)
    val rightPath = formatToTablePath(rightFormat)
    val leftDf = spark.read.format(leftFormat).load(leftPath)
    val rightDf = spark.read.format(rightFormat).load(rightPath)
    MlflowAutologEventPublisher.init()
    val subscriber = spy(new MockSubscriber())
    MlflowAutologEventPublisher.register(subscriber)
    leftDf.join(rightDf).collect()
    // Sleep a second to let the SparkListener trigger read
    Thread.sleep(1000)
    verify(subscriber, times(2)).notify(any(), any(), any())
    verify(subscriber, times(1)).notify(getFileUri(leftPath), "unknown", leftFormat)
    verify(subscriber, times(1)).notify(getFileUri(rightPath), "unknown", rightFormat)
  }

  test("MlflowAutologEventPublisher can publish to working subscribers even when " +
    "others are broken") {
    MlflowAutologEventPublisher.stop()
    val subscriber = spy(new MockSubscriber())
    // Publish to a broken subscriber, then a working one, and finally another broken one
    val subscriberSeq = Seq(new BrokenSubscriber(), subscriber, new BrokenSubscriber())
    object MockPublisher extends MlflowAutologEventPublisherImpl {
      // Override subscriber iteration logic to yield subscribers in the desired order
      override def getSubscribers: Seq[(String, MlflowAutologEventSubscriber)] = {
        subscriberSeq.map(subscriber => (subscriber.replId, subscriber))
      }
    }
    // Disable GC of dead subscribers so that they get published-to
    MockPublisher.init(gcDeadSubscribersIntervalSec = 10000)
    val listeners1 = MlflowSparkAutologgingTestUtils.getListeners(spark)
    assert(listeners1.length == 1)
    val (format, path) = formatToTablePath.head
    val df = spark.read.format(format).load(path)
    // Register subscribers & collect the DF to trigger a datasource read event
    subscriberSeq.foreach(MockPublisher.register)
    df.collect()
    Thread.sleep(1000)
    verify(subscriber, times(1)).notify(any(), any(), any())
    verify(subscriber, times(1)).notify(
      getFileUri(path), "unknown", format)
  }

  test("Exceptions while extracting datasource information from Spark query plan " +
    "do not fail the query") {
    MlflowAutologEventPublisher.stop()
    object MockPublisher extends MlflowAutologEventPublisherImpl {
      // Return a custom listener that throws while processing SparkListenerSQLExecutionEnd events
      override def getSparkDataSourceListener: SparkDataSourceListener = {
        new SparkDataSourceListener {
          override def onSQLExecutionEnd(event: SparkListenerSQLExecutionEnd): Unit = {
            throw new NoSuchMethodException("Mock failure while extracting datasource info from " +
              "query plan!")
          }
        }
      }
    }
    MockPublisher.init()
    val (format, path) = formatToTablePath.head
    val df = spark.read.format(format).load(path)
    val subscriber = new MockSubscriber()
    MockPublisher.register(subscriber)
    df.collect()
  }

  test("MlflowAutologEventPublisher correctly unregisters broken subscribers") {
    MlflowAutologEventPublisher.register(new BrokenSubscriber())
    Thread.sleep(2000)
    assert(MlflowAutologEventPublisher.subscribers.isEmpty)
  }

  test("Subscriber registration fails if init() not called") {
    MlflowAutologEventPublisher.stop()
    intercept[RuntimeException] {
      MlflowAutologEventPublisher.register(new MockSubscriber())
    }
  }

  test("Initializing MlflowAutologEventPublisher fails if SparkSession doesn't exixt") {
    MlflowAutologEventPublisher.stop()
    spark.stop()
    try {
      intercept[RuntimeException] {
        MlflowAutologEventPublisher.init()
      }
    } finally {
      spark = getOrCreateSparkSession()
    }
  }

}
